import { describe, it, expect } from "vitest";
import {
  cliOptionsSchema,
  scenarioSchema,
  ruleSchema,
  scenariosConfigSchema,
} from "../../src/schemas";

describe("cliOptionsSchema", () => {
  it("coerces string port to number", () => {
    const result = cliOptionsSchema.parse({
      target: "https://api.com",
      port: "3000",
    });
    expect(result.port).toBe(3000);
    expect(typeof result.port).toBe("number");
  });

  it("uses default port when not provided", () => {
    const result = cliOptionsSchema.parse({ target: "https://api.com" });
    expect(result.port).toBe(5050);
  });

  it("rejects invalid port range", () => {
    expect(() =>
      cliOptionsSchema.parse({
        target: "https://api.com",
        port: 70000,
      })
    ).toThrow();
  });

  it("rejects invalid URL", () => {
    expect(() =>
      cliOptionsSchema.parse({
        target: "not-a-url",
      })
    ).toThrow();
  });

  it("requires apiPrefix to start with /", () => {
    expect(() =>
      cliOptionsSchema.parse({
        target: "https://api.com",
        apiPrefix: "api",
      })
    ).toThrow();
  });

  it("uses default apiPrefix when not provided", () => {
    const result = cliOptionsSchema.parse({ target: "https://api.com" });
    expect(result.apiPrefix).toBe("/api");
  });

  it("uses default scenarios path when not provided", () => {
    const result = cliOptionsSchema.parse({ target: "https://api.com" });
    expect(result.scenarios).toBe("./scenarios.json");
  });
});

describe("scenarioSchema", () => {
  it("requires either json or file", () => {
    expect(() => scenarioSchema.parse({ status: 200 })).toThrow();
  });

  it("accepts scenario with json", () => {
    const result = scenarioSchema.parse({ json: { ok: true } });
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ ok: true });
  });

  it("accepts scenario with file", () => {
    const result = scenarioSchema.parse({ file: "fixtures/data.json" });
    expect(result.file).toBe("fixtures/data.json");
  });

  it("accepts scenario with both json and file", () => {
    const result = scenarioSchema.parse({
      json: { ok: true },
      file: "fixtures/data.json",
    });
    expect(result.json).toEqual({ ok: true });
    expect(result.file).toBe("fixtures/data.json");
  });

  it("accepts optional delay", () => {
    const result = scenarioSchema.parse({ json: {}, delay: 2 });
    expect(result.delay).toBe(2);
  });

  it("rejects negative delay", () => {
    expect(() => scenarioSchema.parse({ json: {}, delay: -1 })).toThrow();
  });

  it("accepts custom status code", () => {
    const result = scenarioSchema.parse({ json: {}, status: 404 });
    expect(result.status).toBe(404);
  });

  it("rejects invalid status code", () => {
    expect(() => scenarioSchema.parse({ json: {}, status: 99 })).toThrow();
    expect(() => scenarioSchema.parse({ json: {}, status: 600 })).toThrow();
  });
});

describe("ruleSchema", () => {
  const validRule = {
    method: "GET" as const,
    match: "/test",
    enabled: true,
    active_scenario: "success",
    scenarios: { success: { json: {} } },
  };

  it("accepts valid rule", () => {
    const result = ruleSchema.parse(validRule);
    expect(result.method).toBe("GET");
    expect(result.match).toBe("/test");
  });

  it("validates active_scenario exists in scenarios", () => {
    expect(() =>
      ruleSchema.parse({
        ...validRule,
        active_scenario: "nonexistent",
      })
    ).toThrow("active_scenario must exist in scenarios");
  });

  it("accepts all HTTP methods", () => {
    const methods = [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
    ] as const;
    for (const method of methods) {
      const result = ruleSchema.parse({ ...validRule, method });
      expect(result.method).toBe(method);
    }
  });

  it("rejects invalid HTTP method", () => {
    expect(() =>
      ruleSchema.parse({ ...validRule, method: "INVALID" })
    ).toThrow();
  });

  it("requires match to be non-empty", () => {
    expect(() => ruleSchema.parse({ ...validRule, match: "" })).toThrow();
  });

  it("accepts multiple scenarios", () => {
    const result = ruleSchema.parse({
      ...validRule,
      scenarios: {
        success: { json: { id: 1 } },
        error: { status: 500, json: { error: "fail" } },
      },
    });
    expect(Object.keys(result.scenarios)).toHaveLength(2);
  });
});

describe("scenariosConfigSchema", () => {
  it("accepts empty rules array", () => {
    const result = scenariosConfigSchema.parse({ rules: [] });
    expect(result.rules).toEqual([]);
  });

  it("uses default empty rules when not provided", () => {
    const result = scenariosConfigSchema.parse({});
    expect(result.rules).toEqual([]);
  });

  it("accepts valid config with rules", () => {
    const result = scenariosConfigSchema.parse({
      rules: [
        {
          method: "GET",
          match: "/test",
          enabled: true,
          active_scenario: "success",
          scenarios: { success: { json: {} } },
        },
      ],
    });
    expect(result.rules).toHaveLength(1);
  });

  it("validates nested rules", () => {
    expect(() =>
      scenariosConfigSchema.parse({
        rules: [{ method: "INVALID" }],
      })
    ).toThrow();
  });
});
