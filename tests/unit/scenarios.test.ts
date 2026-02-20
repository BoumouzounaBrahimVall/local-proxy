import { describe, it, expect } from "vitest";
import { createScenarioLoader, matchRule } from "../../src/scenarios";
import type { FileSystem, Rule } from "../../src/types";

describe("matchRule", () => {
  const createRule = (overrides: Partial<Rule> = {}): Rule => ({
    method: "GET",
    match: "/test",
    enabled: true,
    active_scenario: "success",
    scenarios: { success: { status: 200, json: {} } },
    ...overrides,
  });

  it("matches exact path and method", () => {
    const rules = [createRule()];
    const result = matchRule(rules, "GET", "/test");
    expect(result).not.toBeNull();
    expect(result?.rule.match).toBe("/test");
  });

  it("returns null for disabled rules", () => {
    const rules = [createRule({ enabled: false })];
    const result = matchRule(rules, "GET", "/test");
    expect(result).toBeNull();
  });

  it("returns null for method mismatch", () => {
    const rules = [createRule({ method: "POST" })];
    const result = matchRule(rules, "GET", "/test");
    expect(result).toBeNull();
  });

  it("returns null for path mismatch", () => {
    const rules = [createRule()];
    const result = matchRule(rules, "GET", "/other");
    expect(result).toBeNull();
  });

  it("is case-insensitive for method", () => {
    const rules = [createRule({ method: "POST" })];
    const result = matchRule(rules, "post", "/test");
    expect(result).not.toBeNull();
  });

  it("normalizes path without leading slash", () => {
    const rules = [createRule({ match: "test" })];
    const result = matchRule(rules, "GET", "/test");
    expect(result).not.toBeNull();
  });

  it("returns the active scenario", () => {
    const rules = [
      createRule({
        active_scenario: "error",
        scenarios: {
          success: { status: 200, json: { ok: true } },
          error: { status: 500, json: { error: "fail" } },
        },
      }),
    ];
    const result = matchRule(rules, "GET", "/test");
    expect(result?.scenario.status).toBe(500);
  });

  it("returns first matching rule", () => {
    const rules = [
      createRule({ match: "/test", active_scenario: "first" }),
      createRule({ match: "/test", active_scenario: "second" }),
    ];
    rules[0]!.scenarios["first"] = { status: 200, json: { first: true } };
    rules[1]!.scenarios["second"] = { status: 200, json: { second: true } };
    
    const result = matchRule(rules, "GET", "/test");
    expect(result?.rule.active_scenario).toBe("first");
  });

  it("returns null when no rules provided", () => {
    const result = matchRule([], "GET", "/test");
    expect(result).toBeNull();
  });
});

describe("createScenarioLoader", () => {
  const createMockFs = (files: Record<string, string> = {}): FileSystem => ({
    existsSync: (path: string) => path in files,
    readFileSync: (path: string) => {
      if (path in files) return files[path]!;
      throw new Error(`File not found: ${path}`);
    },
    writeFileSync: () => {},
  });

  describe("load", () => {
    it("returns empty rules when file does not exist", () => {
      const fs = createMockFs({});
      const loader = createScenarioLoader(fs, "/base");
      const result = loader.load("scenarios.json");
      expect(result.rules).toEqual([]);
    });

    it("parses and validates valid scenarios file", () => {
      const fs = createMockFs({
        "/base/scenarios.json": JSON.stringify({
          rules: [
            {
              method: "GET",
              match: "/test",
              enabled: true,
              active_scenario: "success",
              scenarios: { success: { json: {} } },
            },
          ],
        }),
      });
      const loader = createScenarioLoader(fs, "/base");
      const result = loader.load("scenarios.json");
      expect(result.rules).toHaveLength(1);
    });

    it("throws on invalid JSON", () => {
      const fs = createMockFs({
        "/base/scenarios.json": "invalid json",
      });
      const loader = createScenarioLoader(fs, "/base");
      expect(() => loader.load("scenarios.json")).toThrow("Invalid JSON");
    });

    it("throws on invalid schema", () => {
      const fs = createMockFs({
        "/base/scenarios.json": JSON.stringify({
          rules: [{ method: "INVALID" }],
        }),
      });
      const loader = createScenarioLoader(fs, "/base");
      expect(() => loader.load("scenarios.json")).toThrow(
        "Invalid scenarios config"
      );
    });

    it("resolves relative paths from basePath", () => {
      const fs = createMockFs({
        "/project/config/scenarios.json": JSON.stringify({ rules: [] }),
      });
      const loader = createScenarioLoader(fs, "/project/config");
      const result = loader.load("scenarios.json");
      expect(result.rules).toEqual([]);
    });
  });

  describe("getFixture", () => {
    it("returns file content when exists", () => {
      const fs = createMockFs({
        "/base/fixtures/data.json": '{"test": true}',
      });
      const loader = createScenarioLoader(fs, "/base");
      const result = loader.getFixture("fixtures/data.json");
      expect(result).toBe('{"test": true}');
    });

    it("returns null when file does not exist", () => {
      const fs = createMockFs({});
      const loader = createScenarioLoader(fs, "/base");
      const result = loader.getFixture("fixtures/missing.json");
      expect(result).toBeNull();
    });
  });
});
