import express, { Express } from "express";
import { createMockMiddleware } from "./middleware/mockMiddleware";
import { createProxyMiddlewareFactory } from "./middleware/proxyMiddleware";
import type { AppContext } from "./types";

export function createApp(context: AppContext): Express {
  const app = express();

  app.use(context.apiPrefix, createMockMiddleware(context));

  app.use(
    context.apiPrefix,
    createProxyMiddlewareFactory({
      target: context.target,
      apiPrefix: context.apiPrefix,
      logger: context.logger,
    })
  );

  return app;
}
