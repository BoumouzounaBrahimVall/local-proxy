import { Request, Response, NextFunction } from "express";
import { createScenarioLoader, matchRule } from "../scenarios";
import type { AppContext } from "../types";

export function createMockMiddleware(context: AppContext) {
  const loader = createScenarioLoader(context.fs, context.basePath);

  return (req: Request, res: Response, next: NextFunction): void => {
    let config;
    try {
      config = loader.load(context.scenariosPath);
    } catch (err) {
      context.logger.error(
        "[MOCK ERROR]",
        err instanceof Error ? err.message : err
      );
      res.status(500).json({
        error: "Failed to load scenarios",
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const match = matchRule(config.rules, req.method, req.path);

    if (!match) {
      next();
      return;
    }

    const { rule, scenario } = match;
    context.logger.info(
      `[MOCKED] ${req.method} ${context.apiPrefix}${req.path} -> ${rule.active_scenario}`
    );

    const respond = () => {
      if (scenario.file) {
        const content = loader.getFixture(scenario.file);
        if (!content) {
          res
            .status(500)
            .json({ error: "Fixture not found", file: scenario.file });
          return;
        }
        res
          .status(scenario.status ?? 200)
          .type("application/json")
          .send(content);
      } else {
        res.status(scenario.status ?? 200).json(scenario.json ?? {});
      }
    };

    if (scenario.delay) {
      setTimeout(respond, scenario.delay * 1000);
    } else {
      respond();
    }
  };
}
