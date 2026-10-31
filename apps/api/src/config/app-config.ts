import type { z } from "zod";
import { ConfigError } from "./config-error.js";
import { envSchema, type Env } from "./env.schema.js";

/**
 * The typed configuration. Built once at start-up from the environment, then
 * injected. Nothing else reads `process.env`.
 *
 * Safety rules key off `appEnv`, never `NODE_ENV`.
 */
export class AppConfig {
  readonly appEnv: Env["APP_ENV"];
  readonly nodeEnv: Env["NODE_ENV"];
  readonly demoMode: boolean;
  readonly gitSha: string | null;

  readonly http: {
    readonly host: string;
    readonly port: number;
    readonly trustProxyHops: number;
    readonly corsOrigins: readonly string[];
    readonly swaggerEnabled: boolean;
  };

  readonly rateLimit: {
    readonly windowSeconds: number;
    readonly maxRequests: number;
  };

  readonly logLevel: Env["LOG_LEVEL"];

  private constructor(env: Env) {
    this.appEnv = env.APP_ENV;
    this.nodeEnv = env.NODE_ENV;
    this.demoMode = env.DEMO_MODE;
    this.gitSha = env.GIT_SHA ?? null;
    this.http = {
      host: env.API_HOST,
      port: env.API_PORT,
      trustProxyHops: env.TRUST_PROXY_HOPS,
      corsOrigins: env.CORS_ORIGINS,
      swaggerEnabled: env.SWAGGER_ENABLED ?? env.APP_ENV !== "production",
    };
    this.rateLimit = {
      windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    };
    this.logLevel = env.LOG_LEVEL;
  }

  get isProduction(): boolean {
    return this.appEnv === "production";
  }

  /**
   * Parses the environment. On failure the error names every problem and the
   * file to create, and never repeats a value (it could be a secret).
   */
  static fromEnv(env: NodeJS.ProcessEnv, hints?: ConfigHints): AppConfig {
    const result = envSchema.safeParse(env);
    if (!result.success) {
      throw new ConfigError(describeProblems(result.error, env, hints));
    }
    return new AppConfig(result.data);
  }
}

/** Where the values come from, so the error can say which file to create. */
export interface ConfigHints {
  /** The file to create: the root `.env`. */
  readonly createFile: string;
  /** Every file the API reads, first read first. */
  readonly readFiles: readonly string[];
}

function describeProblems(
  error: z.ZodError,
  env: NodeJS.ProcessEnv,
  hints: ConfigHints | undefined,
): string {
  const lines = error.issues.map((issue) => {
    const name = issue.path.join(".") || "(environment)";
    const state = env[name] === undefined ? "is missing. " : "";
    return `  - ${name}: ${state}${issue.message}`;
  });
  const create = hints
    ? `Create ${hints.createFile} by copying .env.example, set the variables above, and start again.\nThe API reads ${hints.readFiles.join(", then ")}, and never overrides what the shell sets.`
    : "Copy .env.example to .env at the repository root, set the variables above, and start again.";
  return [
    "OrderPilot API cannot start. The environment is not valid:",
    ...lines,
    "",
    create,
  ].join("\n");
}
