import * as path from "path";
import { scenariosConfigSchema } from "./schemas";
import type { ScenariosConfig, Rule, Scenario, FileSystem } from "./types";

export interface ScenarioLoader {
  load(scenariosPath: string): ScenariosConfig;
  getFixture(filePath: string): string | null;
}

export function createScenarioLoader(
  fs: FileSystem,
  basePath: string
): ScenarioLoader {
  return {
    load(scenariosPath: string): ScenariosConfig {
      const fullPath = path.resolve(basePath, scenariosPath);
      if (!fs.existsSync(fullPath)) {
        return { rules: [] };
      }

      const raw = fs.readFileSync(fullPath, "utf-8");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON in ${scenariosPath}`);
      }

      const result = scenariosConfigSchema.safeParse(parsed);
      if (!result.success) {
        const errors = result.error.issues.map(
          (i) => `  ${i.path.join(".")}: ${i.message}`
        );
        throw new Error(`Invalid scenarios config:\n${errors.join("\n")}`);
      }
      return result.data;
    },

    getFixture(filePath: string): string | null {
      const fullPath = path.resolve(basePath, filePath);
      if (!fs.existsSync(fullPath)) return null;
      return fs.readFileSync(fullPath, "utf-8");
    },
  };
}

export function matchRule(
  rules: Rule[],
  method: string,
  requestPath: string
): { rule: Rule; scenario: Scenario } | null {
  const upperMethod = method.toUpperCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.method !== upperMethod) continue;

    const normalizedMatch = rule.match.startsWith("/")
      ? rule.match
      : `/${rule.match}`;
    if (requestPath !== normalizedMatch) continue;

    const scenario = rule.scenarios[rule.active_scenario];
    if (!scenario) continue;

    return { rule, scenario };
  }
  return null;
}
