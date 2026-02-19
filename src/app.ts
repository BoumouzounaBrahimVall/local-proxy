import express from "express";
import { config } from "./config";
import { createMockMiddleware } from "./middleware/mockMiddleware";
import { createProxyMiddlewareFactory } from "./middleware/proxyMiddleware";

export function createApp() {
  const app = express();

  app.use(
    config.apiPrefix,
    createMockMiddleware(config.apiPrefix)
  );

  app.use(
    config.apiPrefix,
    createProxyMiddlewareFactory(config.target, config.apiPrefix)
  );

  return app;
}
