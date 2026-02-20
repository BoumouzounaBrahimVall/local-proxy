import https from "https";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { Logger } from "../types";

export interface ProxyMiddlewareOptions {
  target: string;
  apiPrefix: string;
  logger?: Logger;
}

export function getPathname(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return new URL(path).pathname;
  }
  return path;
}

export interface ProxyErrorRequest {
  originalUrl?: string;
  url?: string;
}

export interface ProxyErrorResponse {
  headersSent: boolean;
  writeHead(statusCode: number, headers: Record<string, string>): void;
  end(data: string): void;
}

export function handleProxyError(
  err: NodeJS.ErrnoException,
  req: ProxyErrorRequest,
  res: ProxyErrorResponse,
  logger: Logger
): void {
  const url = req.originalUrl ?? req.url;
  logger.error("[proxy error]", err.code ?? err.message, "→", url);

  if (!res.headersSent) {
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Bad Gateway",
        message: err.message,
        code: err.code,
      })
    );
  }
}

const noKeepAliveAgent = new https.Agent({ keepAlive: false });

export function createProxyMiddlewareFactory(options: ProxyMiddlewareOptions) {
  const { target, apiPrefix, logger = console } = options;

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
    agent: noKeepAliveAgent,
    pathRewrite: (path) => {
      const pathname = getPathname(path);
      if (pathname.startsWith(apiPrefix)) return pathname;
      return apiPrefix + pathname;
    },
    on: {
      error(
        err: NodeJS.ErrnoException,
        req: import("http").IncomingMessage,
        resOrSocket: import("http").ServerResponse | import("net").Socket
      ) {
        if ("writeHead" in resOrSocket) {
          handleProxyError(
            err,
            req as ProxyErrorRequest,
            resOrSocket as unknown as ProxyErrorResponse,
            logger
          );
        }
      },
    },
  });
}
