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
    cors: false,
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

  it("delays mocked response when scenario.delay is set", async () => {
    const mockFs = createMockFs({
      "scenarios.json": JSON.stringify({
        rules: [
          {
            method: "GET",
            match: "/slow",
            enabled: true,
            active_scenario: "delayed",
            scenarios: {
              delayed: { status: 200, json: { ok: true }, delay: 0.05 },
            },
          },
        ],
      }),
    });

    const app = createApp(createContext({ fs: mockFs }));
    const start = Date.now();
    const res = await request(app).get("/api/slow");
    const elapsed = Date.now() - start;

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(elapsed).toBeGreaterThanOrEqual(45);
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

  describe("CORS", () => {
    it("responds 204 to preflight without forwarding, with CORS headers", async () => {
      const mockFs = createMockFs({ "scenarios.json": JSON.stringify({ rules: [] }) });
      const app = createApp(createContext({ fs: mockFs, cors: true }));

      const res = await request(app)
        .options("/api/anything")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "GET")
        .set("Access-Control-Request-Headers", "Authorization,X-Custom");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
      expect(res.headers["access-control-allow-methods"]).toContain("GET");
      expect(res.headers["access-control-max-age"]).toBe("86400");
    });

    it("adds Access-Control-Allow-Origin to mocked responses when cors enabled", async () => {
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

      const app = createApp(createContext({ fs: mockFs, cors: true }));
      const res = await request(app)
        .get("/api/test")
        .set("Origin", "http://localhost:3000");

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://localhost:3000"
      );
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });

    it("reflects the request Origin when config.origin is auto (scenarios.json)", async () => {
      const mockFs = createMockFs({
        "scenarios.json": JSON.stringify({
          rules: [
            {
              method: "GET",
              match: "/echo",
              enabled: true,
              active_scenario: "ok",
              scenarios: { ok: { json: { ok: true } } },
            },
          ],
          cors: { enabled: true, origin: "auto" },
        }),
      });

      const app = createApp(createContext({ fs: mockFs }));
      const res = await request(app)
        .get("/api/echo")
        .set("Origin", "http://example.test");

      expect(res.headers["access-control-allow-origin"]).toBe(
        "http://example.test"
      );
      expect(res.headers["vary"]).toMatch(/Origin/);
    });

    it("echoes Access-Control-Request-Headers on preflight when allowedHeaders is auto", async () => {
      const mockFs = createMockFs({ "scenarios.json": JSON.stringify({ rules: [] }) });
      const app = createApp(createContext({ fs: mockFs, cors: true }));

      const res = await request(app)
        .options("/api/anything")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "X-One,X-Two");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-headers"]).toBe("X-One,X-Two");
    });

    it("adds no CORS headers when cors is disabled (backwards compat)", async () => {
      const mockFs = createMockFs({
        "scenarios.json": JSON.stringify({
          rules: [
            {
              method: "GET",
              match: "/plain",
              enabled: true,
              active_scenario: "ok",
              scenarios: { ok: { json: { ok: true } } },
            },
          ],
        }),
      });

      const app = createApp(createContext({ fs: mockFs }));
      const res = await request(app)
        .get("/api/plain")
        .set("Origin", "http://localhost:3000");

      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
      expect(res.headers["access-control-allow-methods"]).toBeUndefined();
    });

    it("omits Allow-Credentials when origin resolves to *", async () => {
      const mockFs = createMockFs({
        "scenarios.json": JSON.stringify({
          rules: [
            {
              method: "GET",
              match: "/wild",
              enabled: true,
              active_scenario: "ok",
              scenarios: { ok: { json: { ok: true } } },
            },
          ],
          cors: { enabled: true, origin: "*", credentials: true },
        }),
      });

      const app = createApp(createContext({ fs: mockFs }));
      const res = await request(app)
        .get("/api/wild")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
      expect(res.headers["vary"]).toBeUndefined();
    });

    it("returns the request Origin when it is in the allowed origin array", async () => {
      const mockFs = createMockFs({
        "scenarios.json": JSON.stringify({
          rules: [
            {
              method: "GET",
              match: "/list",
              enabled: true,
              active_scenario: "ok",
              scenarios: { ok: { json: { ok: true } } },
            },
          ],
          cors: {
            enabled: true,
            origin: ["http://a.test", "http://b.test"],
          },
        }),
      });

      const app = createApp(createContext({ fs: mockFs }));
      const res = await request(app)
        .get("/api/list")
        .set("Origin", "http://b.test");

      expect(res.headers["access-control-allow-origin"]).toBe("http://b.test");
      expect(res.headers["vary"]).toMatch(/Origin/);
    });

    it("falls back to the first allowed origin when request Origin is not listed", async () => {
      const mockFs = createMockFs({
        "scenarios.json": JSON.stringify({
          rules: [
            {
              method: "GET",
              match: "/list",
              enabled: true,
              active_scenario: "ok",
              scenarios: { ok: { json: { ok: true } } },
            },
          ],
          cors: {
            enabled: true,
            origin: ["http://a.test", "http://b.test"],
          },
        }),
      });

      const app = createApp(createContext({ fs: mockFs }));
      const res = await request(app)
        .get("/api/list")
        .set("Origin", "http://other.test");

      expect(res.headers["access-control-allow-origin"]).toBe("http://a.test");
    });

    it("uses an explicit allowedHeaders array verbatim", async () => {
      const mockFs = createMockFs({
        "scenarios.json": JSON.stringify({
          rules: [],
          cors: {
            enabled: true,
            allowedHeaders: ["Authorization", "X-Trace-Id"],
          },
        }),
      });

      const app = createApp(createContext({ fs: mockFs }));
      const res = await request(app)
        .options("/api/anything")
        .set("Origin", "http://localhost:3000")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "X-Should-Be-Ignored");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-headers"]).toBe(
        "Authorization, X-Trace-Id"
      );
    });

    it("sets Access-Control-Expose-Headers when configured", async () => {
      const mockFs = createMockFs({
        "scenarios.json": JSON.stringify({
          rules: [
            {
              method: "GET",
              match: "/exposed",
              enabled: true,
              active_scenario: "ok",
              scenarios: { ok: { json: { ok: true } } },
            },
          ],
          cors: {
            enabled: true,
            exposedHeaders: ["Content-Disposition", "X-Total-Count"],
          },
        }),
      });

      const app = createApp(createContext({ fs: mockFs }));
      const res = await request(app)
        .get("/api/exposed")
        .set("Origin", "http://localhost:3000");

      expect(res.headers["access-control-expose-headers"]).toBe(
        "Content-Disposition, X-Total-Count"
      );
    });

    it("sets Vary: Origin on mocked responses when origin is reflected", async () => {
      const mockFs = createMockFs({
        "scenarios.json": JSON.stringify({
          rules: [
            {
              method: "GET",
              match: "/v",
              enabled: true,
              active_scenario: "ok",
              scenarios: { ok: { json: { ok: true } } },
            },
          ],
          cors: { enabled: true, origin: "auto" },
        }),
      });

      const app = createApp(createContext({ fs: mockFs }));
      const res = await request(app)
        .get("/api/v")
        .set("Origin", "http://example.test");

      expect(res.headers["vary"]).toMatch(/Origin/);
    });
  });
});
