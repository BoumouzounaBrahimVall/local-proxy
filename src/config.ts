import * as dotenv from "dotenv";

dotenv.config();

function getEnv(key: string, defaultValue: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

export const config = {
  port: parseInt(getEnv("PORT", "5050"), 10),
  target: getEnv("TARGET", "https://example.com"),
  apiPrefix: getEnv("API_PREFIX", "/api"),
} as const;
