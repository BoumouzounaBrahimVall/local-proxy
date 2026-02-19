import dotenv from "dotenv";

dotenv.config();

function getEnv(key: string, defaultValue: string): string {
  const value = process.env[key] ?? defaultValue;
  if (!value) throw new Error(`Missing required env: ${key}`);
  return value;
}

export const config = {
  port: parseInt(getEnv("PORT", "5050"), 10),
  target: getEnv("TARGET", "https://apigw-dev-maxit.gos.orange.com"),
  apiPrefix: getEnv("API_PREFIX", "/telco/api"),
} as const;
