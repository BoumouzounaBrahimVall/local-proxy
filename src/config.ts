import * as dotenv from "dotenv";
import { appConfigSchema, cliOptionsSchema } from "./schemas";
import type { AppConfig, CliOptions } from "./types";

dotenv.config();

export function parseCliOptions(raw: Record<string, unknown>): CliOptions {
  const result = cliOptionsSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map(
      (i) => `  ${i.path.join(".")}: ${i.message}`
    );
    throw new Error(`Invalid CLI options:\n${errors.join("\n")}`);
  }
  return result.data;
}

export function createConfig(options: Partial<CliOptions> = {}): AppConfig {
  const merged = {
    port: options.port ?? parseInt(process.env["PORT"] ?? "5050", 10),
    target: options.target ?? process.env["TARGET"],
    apiPrefix: options.apiPrefix ?? process.env["API_PREFIX"] ?? "/api",
    scenariosPath: options.scenarios ?? "./scenarios.json",
  };

  const result = appConfigSchema.safeParse(merged);
  if (!result.success) {
    const errors = result.error.issues.map(
      (i) => `  ${i.path.join(".")}: ${i.message}`
    );
    throw new Error(`Invalid configuration:\n${errors.join("\n")}`);
  }
  return result.data;
}
