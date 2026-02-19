export type Scenario = {
  status?: number;
  json?: Record<string, unknown>;
  file?: string;
  delay?: number;
};

export type Rule = {
  method: string;
  match: string;
  enabled: boolean;
  active_scenario: string;
  scenarios: Record<string, Scenario>;
};

export type Config = {
  rules: Rule[];
};
