import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createConfig, parseCliOptions } from "../../src/config";

describe("parseCliOptions", () => {
  it("parses valid options", () => {
    const result = parseCliOptions({
      target: "https://api.example.com",
      port: "8080",
    });
    expect(result.port).toBe(8080);
    expect(result.target).toBe("https://api.example.com");
  });

  it("applies default values", () => {
    const result = parseCliOptions({
      target: "https://api.example.com",
    });
    expect(result.port).toBe(5050);
    expect(result.apiPrefix).toBe("/api");
    expect(result.scenarios).toBe("./scenarios.json");
  });

  it("throws descriptive error for invalid options", () => {
    expect(() => parseCliOptions({ target: "invalid" })).toThrow(
      "Invalid CLI options"
    );
  });

  it("throws for missing target", () => {
    expect(() => parseCliOptions({})).toThrow();
  });
});

describe("createConfig", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env["PORT"];
    delete process.env["TARGET"];
    delete process.env["API_PREFIX"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses defaults when no options provided", () => {
    const config = createConfig({ target: "https://api.test.com" });
    expect(config.port).toBe(5050);
    expect(config.apiPrefix).toBe("/api");
  });

  it("CLI options override env vars", () => {
    process.env["PORT"] = "3000";
    const config = createConfig({
      target: "https://api.test.com",
      port: 8080,
    });
    expect(config.port).toBe(8080);
  });

  it("uses env vars when CLI options not provided", () => {
    process.env["PORT"] = "3000";
    process.env["TARGET"] = "https://env.example.com";
    process.env["API_PREFIX"] = "/v2";
    const config = createConfig({});
    expect(config.port).toBe(3000);
    expect(config.target).toBe("https://env.example.com");
    expect(config.apiPrefix).toBe("/v2");
  });

  it("throws for missing required target", () => {
    expect(() => createConfig({})).toThrow("Invalid configuration");
  });

  it("sets scenariosPath from scenarios option", () => {
    const config = createConfig({
      target: "https://api.test.com",
      scenarios: "./custom/scenarios.json",
    });
    expect(config.scenariosPath).toBe("./custom/scenarios.json");
  });
});
