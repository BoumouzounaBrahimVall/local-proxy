import { createProxyMiddleware } from "http-proxy-middleware";

export function createProxyMiddlewareFactory(target: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: true,
  });
}
