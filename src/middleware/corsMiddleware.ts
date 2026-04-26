import type { Request, Response, NextFunction } from "express";
import { corsConfigSchema } from "../schemas";
import { createScenarioLoader } from "../scenarios";
import type { AppContext, CorsConfig, ScenariosConfig } from "../types";

const DEFAULT_ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "X-Requested-With",
  "Accept",
  "Origin",
];

const ALWAYS_ENABLED_DEFAULTS: CorsConfig = corsConfigSchema.parse({
  enabled: true,
});

export function createCorsMiddleware(context: AppContext) {
  const loader = createScenarioLoader(context.fs, context.basePath);

  return (req: Request, res: Response, next: NextFunction): void => {
    const cors = resolveCorsConfig(context, loader);
    if (!cors?.enabled) {
      next();
      return;
    }

    applyCorsHeaders(req, res, cors);
    res.locals["corsApplied"] = true;

    if (isPreflight(req)) {
      res.status(204).end();
      return;
    }

    next();
  };
}

function resolveCorsConfig(
  context: AppContext,
  loader: { load(path: string): ScenariosConfig },
): CorsConfig | null {
  let scenarioCors: CorsConfig | undefined;
  try {
    scenarioCors = loader.load(context.scenariosPath).cors;
  } catch {
    scenarioCors = undefined;
  }

  if (context.cors) {
    return scenarioCors ?
        { ...scenarioCors, enabled: true }
      : ALWAYS_ENABLED_DEFAULTS;
  }
  return scenarioCors ?? null;
}

function isPreflight(req: Request): boolean {
  return (
    req.method === "OPTIONS" &&
    typeof req.headers["origin"] === "string" &&
    typeof req.headers["access-control-request-method"] === "string"
  );
}

function resolveAllowOrigin(
  requestOrigin: string | undefined,
  origin: CorsConfig["origin"],
): string {
  if (origin === "auto") {
    return requestOrigin ?? "*";
  }
  if (Array.isArray(origin)) {
    if (requestOrigin && origin.includes(requestOrigin)) {
      return requestOrigin;
    }
    return origin[0] ?? "*";
  }
  return origin;
}

function resolveAllowHeaders(
  req: Request,
  allowed: CorsConfig["allowedHeaders"],
): string {
  if (allowed === "auto") {
    const requested = req.headers["access-control-request-headers"];
    if (typeof requested === "string" && requested.length > 0) {
      return requested;
    }
    return DEFAULT_ALLOWED_HEADERS.join(", ");
  }
  return allowed.join(", ");
}

function applyCorsHeaders(req: Request, res: Response, cors: CorsConfig): void {
  const requestOrigin =
    typeof req.headers["origin"] === "string" ?
      req.headers["origin"]
    : undefined;
  const allowOrigin = resolveAllowOrigin(requestOrigin, cors.origin);

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  if (allowOrigin !== "*") {
    res.vary("Origin");
    res.locals["corsVaryOrigin"] = true;
  }

  if (cors.credentials && allowOrigin !== "*") {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", cors.allowedMethods.join(", "));
  res.setHeader(
    "Access-Control-Allow-Headers",
    resolveAllowHeaders(req, cors.allowedHeaders),
  );

  if (cors.exposedHeaders && cors.exposedHeaders.length > 0) {
    res.setHeader(
      "Access-Control-Expose-Headers",
      cors.exposedHeaders.join(", "),
    );
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Max-Age", String(cors.maxAge));
  }
}

export function appendVaryOrigin(
  headers: Record<string, string | string[] | undefined>,
): void {
  const existing = headers["vary"];
  if (!existing) {
    headers["vary"] = "Origin";
    return;
  }
  const current = Array.isArray(existing) ? existing.join(", ") : existing;
  if (current.trim() === "*") return;
  const parts = current.split(",").map((s) => s.trim().toLowerCase());
  if (parts.includes("origin")) return;
  headers["vary"] = current + ", Origin";
}

export const UPSTREAM_CORS_HEADERS = [
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-methods",
  "access-control-allow-headers",
  "access-control-expose-headers",
  "access-control-max-age",
];
