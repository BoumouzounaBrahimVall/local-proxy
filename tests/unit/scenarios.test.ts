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
    expect(result?.params).toEqual({});
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

  it("matches path parameter :id and returns params", () => {
    const rules = [createRule({ match: "/users/:id" })];
    const result = matchRule(rules, "GET", "/users/42");
    expect(result).not.toBeNull();
    expect(result?.params).toEqual({ id: "42" });
  });

  it("matches multiple path parameters", () => {
    const rules = [createRule({ match: "/users/:id/posts/:postId" })];
    const result = matchRule(rules, "GET", "/users/42/posts/7");
    expect(result).not.toBeNull();
    expect(result?.params).toEqual({ id: "42", postId: "7" });
  });

  it("matches wildcard *splat for multi-segment paths", () => {
    const rules = [createRule({ match: "/files/*splat" })];
    const result = matchRule(rules, "GET", "/files/a/b/c.pdf");
    expect(result).not.toBeNull();
    expect(result?.params).toEqual({ splat: "a/b/c.pdf" });
  });

  it("does not match path param rule against wrong path", () => {
    const rules = [createRule({ match: "/users/:id" })];
    const result = matchRule(rules, "GET", "/orders/42");
    expect(result).toBeNull();
  });

  it("literal path takes precedence over param rule when placed first", () => {
    const rules = [
      createRule({ match: "/users/me", active_scenario: "me" }),
      createRule({ match: "/users/:id", active_scenario: "byId" }),
    ];
    rules[0]!.scenarios["me"] = { status: 200, json: { self: true } };
    rules[1]!.scenarios["byId"] = { status: 200, json: { user: true } };

    const result = matchRule(rules, "GET", "/users/me");
    expect(result?.rule.active_scenario).toBe("me");
  });

  it("param rule matches when literal rule placed after it", () => {
    const rules = [
      createRule({ match: "/users/:id", active_scenario: "byId" }),
      createRule({ match: "/users/me", active_scenario: "me" }),
    ];
    rules[0]!.scenarios["byId"] = { status: 200, json: { user: true } };
    rules[1]!.scenarios["me"] = { status: 200, json: { self: true } };

    const result = matchRule(rules, "GET", "/users/me");
    expect(result?.rule.active_scenario).toBe("byId");
  });

  it("decodes percent-encoded path parameters", () => {
    const rules = [createRule({ match: "/search/:query" })];
    const result = matchRule(rules, "GET", "/search/hello%20world");
    expect(result).not.toBeNull();
    expect(result?.params).toEqual({ query: "hello world" });
  });
});

describe("createScenarioLoader", () => {
  const createMockFs = (files: Record<string, string | Buffer> = {}): FileSystem => ({
    existsSync: (path: string) => path in files,
    readFileSync: ((path: string, encoding?: BufferEncoding): string | Buffer => {
      const content = files[path];
      if (content === undefined) throw new Error(`File not found: ${path}`);
      if (encoding !== undefined) {
        return typeof content === "string" ? content : content.toString(encoding);
      }
      return typeof content === "string" ? Buffer.from(content) : content;
    }) as FileSystem["readFileSync"],
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
    it("returns file content as Buffer when file exists", () => {
      const fs = createMockFs({
        "/base/fixtures/data.json": '{"test": true}',
      });
      const loader = createScenarioLoader(fs, "/base");
      const result = loader.getFixture("fixtures/data.json");
      expect(result).toBeInstanceOf(Buffer);
      expect(result?.toString()).toBe('{"test": true}');
    });

    it("returns null when file does not exist", () => {
      const fs = createMockFs({});
      const loader = createScenarioLoader(fs, "/base");
      const result = loader.getFixture("fixtures/missing.json");
      expect(result).toBeNull();
    });

    it("preserves non-UTF-8 binary bytes unchanged", () => {
      const binaryData = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG magic bytes
      const fs = createMockFs({ "/base/fixtures/image.jpg": binaryData });
      const loader = createScenarioLoader(fs, "/base");
      const result = loader.getFixture("fixtures/image.jpg");
      expect(result).toBeInstanceOf(Buffer);
      expect(result).toEqual(binaryData);
    });
  });
});
