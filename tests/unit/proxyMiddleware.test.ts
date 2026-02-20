import { describe, it, expect, vi } from "vitest";
import {
  getPathname,
  handleProxyError,
  type ProxyErrorRequest,
  type ProxyErrorResponse,
} from "../../src/middleware/proxyMiddleware";
import type { Logger } from "../../src/types";

describe("getPathname", () => {
  it("extracts pathname from http URL", () => {
    const result = getPathname("http://example.com/api/users");
    expect(result).toBe("/api/users");
  });

  it("extracts pathname from https URL", () => {
    const result = getPathname("https://example.com/api/v1/items?foo=bar");
    expect(result).toBe("/api/v1/items");
  });

  it("returns path as-is when not a full URL", () => {
    const result = getPathname("/api/users");
    expect(result).toBe("/api/users");
  });

  it("handles URL with no path", () => {
    const result = getPathname("https://example.com");
    expect(result).toBe("/");
  });

  it("handles relative paths", () => {
    const result = getPathname("users/123");
    expect(result).toBe("users/123");
  });
});

describe("handleProxyError", () => {
  const createMockLogger = (): Logger => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });

  const createMockResponse = (
    headersSent = false
  ): ProxyErrorResponse & { written: { status: number; body: string } | null } => ({
    headersSent,
    written: null,
    writeHead(statusCode: number) {
      this.written = { status: statusCode, body: "" };
    },
    end(data: string) {
      if (this.written) {
        this.written.body = data;
      }
    },
  });

  it("logs the error with error code", () => {
    const logger = createMockLogger();
    const req: ProxyErrorRequest = { originalUrl: "/api/users" };
    const res = createMockResponse();
    const err: NodeJS.ErrnoException = new Error("Connection refused");
    err.code = "ECONNREFUSED";

    handleProxyError(err, req, res, logger);

    expect(logger.error).toHaveBeenCalledWith(
      "[proxy error]",
      "ECONNREFUSED",
      "→",
      "/api/users"
    );
  });

  it("logs error message when no code", () => {
    const logger = createMockLogger();
    const req: ProxyErrorRequest = { url: "/api/items" };
    const res = createMockResponse();
    const err: NodeJS.ErrnoException = new Error("Timeout");

    handleProxyError(err, req, res, logger);

    expect(logger.error).toHaveBeenCalledWith(
      "[proxy error]",
      "Timeout",
      "→",
      "/api/items"
    );
  });

  it("writes 502 response with error details", () => {
    const logger = createMockLogger();
    const req: ProxyErrorRequest = { originalUrl: "/api/test" };
    const res = createMockResponse();
    const err: NodeJS.ErrnoException = new Error("Connection reset");
    err.code = "ECONNRESET";

    handleProxyError(err, req, res, logger);

    expect(res.written?.status).toBe(502);
    expect(JSON.parse(res.written?.body ?? "{}")).toEqual({
      error: "Bad Gateway",
      message: "Connection reset",
      code: "ECONNRESET",
    });
  });

  it("does not write response if headers already sent", () => {
    const logger = createMockLogger();
    const req: ProxyErrorRequest = { originalUrl: "/api/test" };
    const res = createMockResponse(true); // headersSent = true
    const err: NodeJS.ErrnoException = new Error("Error");

    handleProxyError(err, req, res, logger);

    expect(res.written).toBeNull();
    expect(logger.error).toHaveBeenCalled(); // Still logs
  });

  it("uses req.url when originalUrl is not set", () => {
    const logger = createMockLogger();
    const req: ProxyErrorRequest = { url: "/fallback/url" };
    const res = createMockResponse();
    const err: NodeJS.ErrnoException = new Error("Error");

    handleProxyError(err, req, res, logger);

    expect(logger.error).toHaveBeenCalledWith(
      "[proxy error]",
      "Error",
      "→",
      "/fallback/url"
    );
  });
});
