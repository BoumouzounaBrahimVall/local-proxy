import * as path from "path";
import { match } from "path-to-regexp";
import { scenariosConfigSchema } from "./schemas";
import type { ScenariosConfig, Rule, Scenario, FileSystem } from "./types";

const matchFnCache = new Map<string, ReturnType<typeof match>>();

function getMatchFn(pattern: string): ReturnType<typeof match> {
  let fn = matchFnCache.get(pattern);
  if (!fn) {
    fn = match(pattern, { decode: decodeURIComponent });
    matchFnCache.set(pattern, fn);
  }
  return fn;
}

export interface ScenarioLoader {
  load(scenariosPath: string): ScenariosConfig;
  getFixture(filePath: string): Buffer | null;
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

    getFixture(filePath: string): Buffer | null {
      const fullPath = path.resolve(basePath, filePath);
      if (!fs.existsSync(fullPath)) return null;
      return fs.readFileSync(fullPath);
    },
  };
}

export function matchRule(
  rules: Rule[],
  method: string,
  requestPath: string
): { rule: Rule; scenario: Scenario; params: Record<string, string> } | null {
  const upperMethod = method.toUpperCase();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.method !== upperMethod) continue;

    const normalizedMatch = rule.match.startsWith("/")
      ? rule.match
      : `/${rule.match}`;

    const result = getMatchFn(normalizedMatch)(requestPath);
    if (!result) continue;

    const scenario = rule.scenarios[rule.active_scenario];
    if (!scenario) continue;

    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(result.params)) {
      if (Array.isArray(value)) {
        params[key] = value.join("/");
      } else if (value !== undefined) {
        params[key] = value as string;
      }
    }

    return { rule, scenario, params };
  }
  return null;
}
