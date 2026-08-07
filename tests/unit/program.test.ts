import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildProgram } from "../../src/program";

function parseWith(argv: string[] = []) {
  const program = buildProgram("0.0.0-test");
  program.exitOverride();
  program.parse(["node", "local-proxy", ...argv]);
  return program.opts();
}

describe("buildProgram option resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    for (const key of ["PORT", "TARGET", "API_PREFIX", "SCENARIOS"]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("falls back to defaults when neither flag nor env is set", () => {
    const opts = parseWith();
    expect(opts["port"]).toBe("5050");
    expect(opts["apiPrefix"]).toBe("/api");
    expect(opts["scenarios"]).toBe("./scenarios.json");
    expect(opts["target"]).toBeUndefined();
  });

  it("reads options from the environment", () => {
    process.env["PORT"] = "3000";
    process.env["TARGET"] = "https://env.example.com";
    process.env["API_PREFIX"] = "/v2";
    process.env["SCENARIOS"] = "./custom.json";

    const opts = parseWith();
    expect(opts["port"]).toBe("3000");
    expect(opts["target"]).toBe("https://env.example.com");
    expect(opts["apiPrefix"]).toBe("/v2");
    expect(opts["scenarios"]).toBe("./custom.json");
  });

  it("lets an explicit flag win over the environment", () => {
    process.env["PORT"] = "3000";
    process.env["API_PREFIX"] = "/v2";

    const opts = parseWith(["--port", "6001", "--api-prefix", "/v3"]);
    expect(opts["port"]).toBe("6001");
    expect(opts["apiPrefix"]).toBe("/v3");
  });

  it("resolves target from either flag or env", () => {
    expect(parseWith(["--target", "https://flag.example.com"])["target"]).toBe(
      "https://flag.example.com",
    );

    process.env["TARGET"] = "https://env.example.com";
    expect(parseWith()["target"]).toBe("https://env.example.com");
  });
});
