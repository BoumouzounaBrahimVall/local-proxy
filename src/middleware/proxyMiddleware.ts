import https from "https";
import { createProxyMiddleware } from "http-proxy-middleware";

function getPathname(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return new URL(path).pathname;
  }
  return path;
}

/** Fresh connection per request to avoid ECONNRESET when backend closes connections. */
const noKeepAliveAgent = new https.Agent({ keepAlive: false });

export function createProxyMiddlewareFactory(
  target: string,
  pathPrefix: string
) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
    agent: noKeepAliveAgent,
    pathRewrite: (path) => {
      const pathname = getPathname(path);
      if (pathname.startsWith(pathPrefix)) return pathname;
      return pathPrefix + pathname;
    },
    on: {
      error(
        err: NodeJS.ErrnoException,
        req: import("http").IncomingMessage,
        resOrSocket: import("http").ServerResponse | import("net").Socket
      ) {
        const url = (req as { originalUrl?: string }).originalUrl ?? req.url;
        console.error("[proxy error]", err.code ?? err.message, "→", url);
        if ("writeHead" in resOrSocket && !resOrSocket.headersSent) {
          resOrSocket.writeHead(502, { "Content-Type": "application/json" });
          resOrSocket.end(
            JSON.stringify({
              error: "Bad Gateway",
              message: err.message,
              code: err.code,
            })
          );
        }
      },
    },
  });
}
