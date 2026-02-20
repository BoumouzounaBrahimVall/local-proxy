import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import type { FileSystem, Logger, AppContext } from "../../src/types";

describe("App Integration", () => {
  const createMockFs = (files: Record<string, string> = {}): FileSystem => ({
    existsSync: (path: string) =>
      Object.keys(files).some((f) => path.endsWith(f)),
    readFileSync: (path: string) => {
      const key = Object.keys(files).find((f) => path.endsWith(f));
      if (key) return files[key]!;
      throw new Error(`File not found: ${path}`);
    },
    writeFileSync: () => {},
  });

  const createMockLogger = (): Logger => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });

  const createContext = (
    overrides: Partial<AppContext> = {}
  ): AppContext => ({
    port: 5050,
    target: "https://example.com",
    apiPrefix: "/api",
    scenariosPath: "scenarios.json",
    fs: createMockFs({}),
    logger: createMockLogger(),
    basePath: "/test",
    ...overrides,
  });

  it("returns mocked response for matched route", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/test",
            enabled: true,
            active_scenario: "success",
            scenarios: { success: { status: 200, json: { ok: true } } },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/test");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns custom status code from scenario", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/error",
            enabled: true,
            active_scenario: "error",
            scenarios: { error: { status: 500, json: { error: "Server Error" } } },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/error");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Server Error" });
  });

  it("returns fixture file content", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/data",
            enabled: true,
            active_scenario: "fromFile",
            scenarios: { fromFile: { file: "fixtures/data.json" } },
          },
        ],
      }),
      "fixtures/data.json": '{"source": "file"}',
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/data");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ source: "file" });
  });

  it("returns 500 when fixture file not found", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/missing",
            enabled: true,
            active_scenario: "missing",
            scenarios: { missing: { file: "fixtures/missing.json" } },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/missing");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Fixture not found");
  });

  it("logs mocked requests", async () => {
    const mockLogger = createMockLogger();
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "POST",
            match: "/users",
            enabled: true,
            active_scenario: "created",
            scenarios: { created: { status: 201, json: { id: 1 } } },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs, logger: mockLogger }));
    await request(app).post("/api/users");

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("[MOCKED]")
    );
  });

  it("handles invalid scenarios.json gracefully", async () => {
    const mockFs = createMockFs({
      "scenarios.json": "invalid json",
    });
    const mockLogger = createMockLogger();

    const app = createApp(createContext({ fs: mockFs, logger: mockLogger }));
    const res = await request(app).get("/api/test");

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Failed to load scenarios");
  });

  it("skips disabled rules and forwards to proxy", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/disabled",
            enabled: false,
            active_scenario: "success",
            scenarios: { success: { json: { mocked: true } } },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/disabled");

    // Request goes to proxy (not mocked), proxy forwards to target
    // Target returns 404 (or proxy error)
    expect([404, 502]).toContain(res.status);
  });

  it("forwards to proxy when scenarios.json does not exist", async () => {
    const mockFs = createMockFs({});

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/anything");

    // No mock matches, request goes to proxy
    // Proxy forwards to target which returns 404 or error
    expect([404, 502]).toContain(res.status);
  });
});
