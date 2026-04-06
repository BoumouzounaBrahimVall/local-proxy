import { z } from "zod/v4";

export const cliOptionsSchema = z.object({
  port: z.coerce.number().int().min(1).max(65535).default(5050),
  target: z.string().url("target must be a valid URL"),
  apiPrefix: z
    .string()
    .refine((val) => val.startsWith("/"), "apiPrefix must start with /")
    .default("/api"),
  scenarios: z.string().default("./scenarios.json"),
  init: z.boolean().optional(),
});

export type CliOptions = z.infer<typeof cliOptionsSchema>;

export const appConfigSchema = z.object({
  port: z.number().int().min(1).max(65535),
  target: z.string().url(),
  apiPrefix: z.string().refine((val) => val.startsWith("/")),
  scenariosPath: z.string(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;

const baseScenarioFields = {
  status: z.number().int().min(100).max(599).optional().default(200),
  delay: z.number().positive().optional(),
};

export const jsonScenarioSchema = z
  .object({
    ...baseScenarioFields,
    json: z.record(z.string(), z.unknown()),
  })
  .strict();

export type JsonScenario = z.infer<typeof jsonScenarioSchema>;

export const fileScenarioSchema = z.object({
  ...baseScenarioFields,
  file: z.string(),
  contentType: z.string().optional(),
}).strict();

export type FileScenario = z.infer<typeof fileScenarioSchema>;

export const scenarioSchema = z.union([jsonScenarioSchema, fileScenarioSchema]);

export type Scenario = z.infer<typeof scenarioSchema>;

export const ruleSchema = z
  .object({
    method: z.enum([
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "HEAD",
      "OPTIONS",
    ]),
    match: z.string().min(1),
    enabled: z.boolean(),
    active_scenario: z.string(),
    scenarios: z.record(z.string(), scenarioSchema),
  })
  .refine((data) => data.active_scenario in data.scenarios, {
    message: "active_scenario must exist in scenarios",
  });

export type Rule = z.infer<typeof ruleSchema>;

export const scenariosConfigSchema = z.object({
  rules: z.array(ruleSchema).default([]),
});

export type ScenariosConfig = z.infer<typeof scenariosConfigSchema>;
