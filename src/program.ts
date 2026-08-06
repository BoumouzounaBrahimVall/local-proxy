import { Command, Option } from "commander";

/**
 * Builds the CLI option parser, without an action handler so it can be
 * exercised in isolation.
 *
 * Each configurable option declares .env(): commander then resolves
 * flag > environment > default. A plain default value would always be
 * present in the parsed options and mask the env fallbacks in createConfig.
 */
export function buildProgram(version: string): Command {
  return new Command()
    .name("local-proxy")
    .description("Local development proxy with scenario-based mocking")
    .version(version)
    .addOption(
      new Option("-t, --target <url>", "Upstream API URL").env("TARGET"),
    )
    .addOption(
      new Option("-p, --port <number>", "Port to listen on")
        .env("PORT")
        .default("5050"),
    )
    .addOption(
      new Option("-a, --api-prefix <path>", "API path prefix")
        .env("API_PREFIX")
        .default("/api"),
    )
    .addOption(
      new Option("-s, --scenarios <file>", "Path to scenarios.json")
        .env("SCENARIOS")
        .default("./scenarios.json"),
    )
    .option("--init", "Create a scenarios.json template in current directory")
    .option("--cors", "Enable permissive CORS headers for browser dev use");
}
