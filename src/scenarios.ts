import * as fs from "fs";
import * as path from "path";
import { Response } from "express";
import type { Config, Scenario } from "./types";

const SCENARIOS_PATH = path.join(__dirname, "..", "scenarios.json");

export function loadScenarios(): Config {
  if (!fs.existsSync(SCENARIOS_PATH)) {
    console.warn("⚠ scenarios.json not found");
    return { rules: [] };
  }
  const raw = fs.readFileSync(SCENARIOS_PATH, "utf-8");
  return JSON.parse(raw) as Config;
}

export function respondScenario(res: Response, scenario: Scenario): Response {
  const status = scenario.status ?? 200;

  if (scenario.file) {
    const filePath = path.join(__dirname, "..", scenario.file);
    if (!fs.existsSync(filePath)) {
      return res.status(500).json({
        error: "Fixture file not found",
        file: scenario.file,
      });
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return res.status(status).type("application/json").send(raw);
  }

  return res.status(status).json(scenario.json ?? {});
}
