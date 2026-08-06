#!/usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import { parseCliOptions, createConfig } from "./config";
import { createApp } from "./app";
import { buildProgram } from "./program";

const packageJsonPath = path.join(__dirname, "..", "package.json");
const packageJson = JSON.parse(
  fs.readFileSync(packageJsonPath, "utf-8")
) as { version: string };

const program = buildProgram(packageJson.version);

program.action((rawOptions: Record<string, unknown>) => {

  if (!rawOptions["target"] && !rawOptions["init"]) {
    program.help();
  }

  let options;
  try {
    options = parseCliOptions(rawOptions);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (!options.init && !options.target) {
    console.error("Invalid CLI options:\n  target: target must be a valid URL");
    process.exit(1);
  }

  if (options.init) {
    const templatePath = path.join(__dirname, "..", "templates", "scenarios.json");
    const destPath = path.resolve(process.cwd(), "scenarios.json");

    if (fs.existsSync(destPath)) {
      console.error("scenarios.json already exists");
      process.exit(1);
    }

    fs.copyFileSync(templatePath, destPath);
    console.log("Created scenarios.json");
    return;
  }

  let config;
  try {
    config = createConfig(options);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const app = createApp({
    ...config,
    logger: console,
    fs,
    basePath: process.cwd(),
  });

  const server = app.listen(config.port, () => {
    console.log(
      `Local proxy running at http://localhost:${config.port}${config.apiPrefix}`
    );
    console.log(`Proxying to: ${config.target}${config.apiPrefix}`);
  });

  // as PID 1 in a container no default signal disposition applies, so without
  // these the process is SIGKILLed (exit 137) with requests still in flight
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      console.log(`\nReceived ${signal}, shutting down`);
      server.close(() => process.exit(0));
    });
  }
});

program.parse();
