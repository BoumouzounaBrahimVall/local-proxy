import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import type { FileSystem, Logger, AppContext } from "../../src/types";

describe("App Integration", () => {
  const createMockFs = (files: Record<string, string | Buffer> = {}): FileSystem => ({
    existsSync: (path: string) =>
      Object.keys(files).some((f) => path.endsWith(f)),
    readFileSync: ((path: string, encoding?: BufferEncoding): string | Buffer => {
      const key = Object.keys(files).find((f) => path.endsWith(f));
      if (!key) throw new Error(`File not found: ${path}`);
      const content = files[key]!;
      if (encoding !== undefined) {
        return typeof content === "string" ? content : content.toString(encoding);
      }
      return typeof content === "string" ? Buffer.from(content) : content;
    }) as FileSystem["readFileSync"],
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

  it("defaults Content-Type to application/json for file scenario without contentType", async () => {
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
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ source: "file" });
  });

  it("serves binary fixture with explicit contentType", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/report.pdf",
            enabled: true,
            active_scenario: "success",
            scenarios: {
              success: {
                status: 200,
                file: "fixtures/report.pdf",
                contentType: "application/pdf",
              },
            },
          },
        ],
      }),
      "fixtures/report.pdf": "%PDF-1.4 fake pdf content",
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/report.pdf");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
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

  it("matches path parameter rule and returns mocked response", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/users/:id",
            enabled: true,
            active_scenario: "success",
            scenarios: { success: { status: 200, json: { name: "Ismail" } } },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/users/42");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "Ismail" });
  });

  it("logs path params in mocked request", async () => {
    const mockLogger = createMockLogger();
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/users/:id",
            enabled: true,
            active_scenario: "success",
            scenarios: { success: { status: 200, json: { name: "Ismail" } } },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs, logger: mockLogger }));
    await request(app).get("/api/users/42");

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('{"id":"42"}')
    );
  });

  it("matches nested path parameters", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/users/:id/posts/:postId",
            enabled: true,
            active_scenario: "success",
            scenarios: { success: { status: 200, json: { post: true } } },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/users/42/posts/7");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ post: true });
  });

  it("matches wildcard *splat rule", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/files/*splat",
            enabled: true,
            active_scenario: "success",
            scenarios: {
              success: {
                file: "fixtures/report.pdf",
                contentType: "application/pdf",
              },
            },
          },
        ],
      }),
      "fixtures/report.pdf": "%PDF-1.4 fake",
    });

    const app = createApp(createContext({ fs: mockFs }));
    const res = await request(app).get("/api/files/a/b/report.pdf");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/pdf/);
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
