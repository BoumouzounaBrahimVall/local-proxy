export type {
  AppConfig,
  CliOptions,
  Scenario,
  JsonScenario,
  FileScenario,
  Rule,
  ScenariosConfig,
  CorsConfig,
} from "./schemas";

export interface Logger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface FileSystem {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: BufferEncoding): string;
  readFileSync(path: string): Buffer;
  writeFileSync(path: string, data: string): void;
}

export interface AppContext {
  port: number;
  target: string;
  apiPrefix: string;
  scenariosPath: string;
  logger: Logger;
  fs: FileSystem;
  basePath: string;
  cors: boolean;
}
