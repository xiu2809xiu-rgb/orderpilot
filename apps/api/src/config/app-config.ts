import type { z } from "zod";
import type { AiProvider } from "@orderpilot/shared";
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
  readonly demoStoryline: boolean;
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

  readonly auth: {
    readonly jwtSecret: string;
    readonly accessTokenTtlSeconds: number;
    readonly refreshTokenTtlSeconds: number;
    readonly cookieSecure: boolean;
    readonly rateLimitMaxRequests: number;
    /** Null means the seeded accounts have no password. */
    readonly demoPassword: string | null;
  };

  readonly logLevel: Env["LOG_LEVEL"];

  readonly monitoring: {
    /** Null means traces and metrics are made but never leave the process. */
    readonly otlpEndpoint: string | null;
    /** Null means /metrics is switched off. */
    readonly metricsToken: string | null;
    /** Null means no error is ever sent to Sentry. */
    readonly sentryDsn: string | null;
  };

  readonly governance: {
    /** Null means a bank-detail comparison fails closed. */
    readonly bankFingerprintKey: string | null;
  };

  /**
   * The AI gateway's settings (P-17). The secrets here are for the providers
   * only: nothing prints this block, and no route returns it.
   */
  readonly ai: {
    /** The AI_PROVIDER setting, which is also what the usage record stores. */
    readonly provider: Env["AI_PROVIDER"];
    /** What area 4's data-to-AI policy sees: gemini and groq are openai-compatible. */
    readonly kind: AiProvider;
    /** The chosen provider's key. Null for the mock, Bedrock, or a local server with none. */
    readonly apiKey: string | null;
    /** Only for openai-compatible. The gemini and groq presets carry their own. */
    readonly baseUrl: string | null;
    /** Null only for the mock. */
    readonly model: string | null;
    /** Falls back to the model. */
    readonly visionModel: string | null;
    readonly structuredOutput: Env["AI_STRUCTURED_OUTPUT"];
    readonly timeoutMs: number;
    readonly maxAttempts: number;
    readonly maxToolSteps: number;
    readonly maxImagesPerRequest: number;
    readonly maxOutputTokens: number;
    /** Decimal strings, USD per million tokens. */
    readonly priceInputUsdPerMtok: string;
    readonly priceOutputUsdPerMtok: string;
    /** Null unless the provider is bedrock. */
    readonly bedrock: {
      readonly region: string;
      readonly accessKeyId: string;
      readonly secretAccessKey: string;
      readonly sessionToken: string | null;
    } | null;
  };

  readonly database: { readonly url: string };
  readonly redis: { readonly url: string };
  readonly workflows: { readonly sweepSeconds: number };

  readonly storage: {
    /** Null means AWS S3 itself. */
    readonly endpoint: string | null;
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
    readonly bucket: string;
    readonly forcePathStyle: boolean;
    readonly createBucket: boolean;
  };

  private constructor(env: Env) {
    this.appEnv = env.APP_ENV;
    this.nodeEnv = env.NODE_ENV;
    this.demoMode = env.DEMO_MODE;
    this.demoStoryline = env.DEMO_STORYLINE;
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
    this.auth = {
      jwtSecret: env.JWT_SECRET,
      accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
      cookieSecure: env.COOKIE_SECURE,
      rateLimitMaxRequests: env.AUTH_RATE_LIMIT_MAX_REQUESTS,
      demoPassword: env.DEMO_PASSWORD ?? null,
    };
    this.logLevel = env.LOG_LEVEL;
    this.monitoring = {
      otlpEndpoint:
        env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/+$/, "") ?? null,
      metricsToken: env.METRICS_TOKEN ?? null,
      sentryDsn: env.SENTRY_DSN ?? null,
    };
    this.governance = {
      bankFingerprintKey: env.BANK_FINGERPRINT_KEY ?? null,
    };
    this.ai = aiSettings(env);
    this.database = { url: env.DATABASE_URL };
    this.redis = { url: env.REDIS_URL };
    this.workflows = { sweepSeconds: env.WORKFLOW_SWEEP_SECONDS };
    this.storage = {
      endpoint: env.S3_ENDPOINT ?? null,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      bucket: env.S3_BUCKET,
      forcePathStyle: env.S3_FORCE_PATH_STYLE ?? env.S3_ENDPOINT !== undefined,
      createBucket: env.S3_CREATE_BUCKET,
    };
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

/** The settings of the chosen provider. The schema has already checked that they are there. */
function aiSettings(env: Env): AppConfig["ai"] {
  const provider = env.AI_PROVIDER;
  const apiKeys = {
    mock: null,
    gemini: env.GEMINI_API_KEY ?? null,
    groq: env.GROQ_API_KEY ?? null,
    "openai-compatible": env.AI_API_KEY ?? null,
    bedrock: null,
  } as const;
  const bedrock =
    provider === "bedrock" &&
    env.AI_BEDROCK_REGION !== undefined &&
    env.AI_BEDROCK_ACCESS_KEY_ID !== undefined &&
    env.AI_BEDROCK_SECRET_ACCESS_KEY !== undefined
      ? {
          region: env.AI_BEDROCK_REGION,
          accessKeyId: env.AI_BEDROCK_ACCESS_KEY_ID,
          secretAccessKey: env.AI_BEDROCK_SECRET_ACCESS_KEY,
          sessionToken: env.AI_BEDROCK_SESSION_TOKEN ?? null,
        }
      : null;
  return {
    provider,
    kind:
      provider === "mock" || provider === "bedrock"
        ? provider
        : "openai-compatible",
    apiKey: apiKeys[provider],
    baseUrl:
      provider === "openai-compatible" ? (env.AI_BASE_URL ?? null) : null,
    model: provider === "mock" ? null : (env.AI_MODEL ?? null),
    visionModel:
      provider === "mock"
        ? null
        : (env.AI_VISION_MODEL ?? env.AI_MODEL ?? null),
    structuredOutput: env.AI_STRUCTURED_OUTPUT,
    timeoutMs: env.AI_TIMEOUT_MS,
    maxAttempts: env.AI_MAX_ATTEMPTS,
    maxToolSteps: env.AI_MAX_TOOL_STEPS,
    maxImagesPerRequest: env.AI_MAX_IMAGES_PER_REQUEST,
    maxOutputTokens: env.AI_MAX_OUTPUT_TOKENS,
    priceInputUsdPerMtok: env.AI_PRICE_INPUT_USD_PER_MTOK,
    priceOutputUsdPerMtok: env.AI_PRICE_OUTPUT_USD_PER_MTOK,
    bedrock,
  };
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
