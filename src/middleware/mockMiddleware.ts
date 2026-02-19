import { Request, Response, NextFunction } from "express";
import { loadScenarios, respondScenario } from "../scenarios";
import type { Config } from "../types";

export function createMockMiddleware(apiPrefix: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ruleConfig: Config = loadScenarios();
    const method = req.method.toUpperCase();
    const fullPath = req.path;

    for (const rule of ruleConfig.rules ?? []) {
      if (!rule.enabled) continue;
      if (rule.method.toUpperCase() !== method) continue;

      const normalizedMatch = rule.match.startsWith("/")
        ? rule.match
        : `/${rule.match}`;

      if (fullPath !== normalizedMatch) continue;

      const scenario = rule.scenarios[rule.active_scenario];
      if (!scenario) {
        next();
        return;
      }

      if (scenario.delay) {
        setTimeout(
          () => respondScenario(res, scenario),
          scenario.delay * 1000
        );
        return;
      }

      console.log(
        `[MOCKED] ${method} ${apiPrefix}${fullPath} -> ${rule.active_scenario}`
      );
      respondScenario(res, scenario);
      return;
    }

    next();
  };
}
