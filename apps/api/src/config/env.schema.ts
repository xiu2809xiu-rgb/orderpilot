import { AI_PROVIDER_SETTINGS } from "@orderpilot/shared";
import { z } from "zod";

/** Where the API runs. Separate from NODE_ENV: a demo stack runs in production mode. */
export const APP_ENVS = ["local", "demo", "production"] as const;

const booleanFlag = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

/** Comma-separated origins, such as `http://localhost:5173,https://demo.example.com`. */
const originList = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(
    z.array(
      z.string().refine(isOrigin, {
        message: "Each origin must look like https://host[:port], with no path",
      }),
    ),
  );

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

/**
 * An empty or blank value counts as unset. Compose passes a bare name through
 * as an empty string, and a person who blanks a line in .env means "off".
 */
function unsetWhenEmpty(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const optionalText = z.preprocess(
  unsetWhenEmpty,
  z.string().trim().min(1).optional(),
);

/** A key for a model provider. Long enough to be real is not checked: providers differ. */
const optionalSecret = z.preprocess(
  unsetWhenEmpty,
  z.string().trim().min(1).max(4096).optional(),
);

function boundedInt(min: number, max: number, fallback: number) {
  return z.preprocess(
    unsetWhenEmpty,
    z.coerce.number().int().min(min).max(max).default(fallback),
  );
}

/** A price in USD per million tokens, as a decimal string so no float is involved. */
const priceText = z.preprocess(
  unsetWhenEmpty,
  z
    .string()
    .trim()
    .regex(/^\d{1,6}(\.\d{1,6})?$/, "Must be a plain decimal such as 0.15")
    .default("0"),
);

/** Where an OpenAI-compatible provider is reached: http or https, and no key in the URL. */
const baseUrlText = z.preprocess(
  unsetWhenEmpty,
  z
    .string()
    .trim()
    .refine(isPlainHttpUrl, {
      message:
        "Must be an http or https URL such as https://host/v1, with no user name or password in it",
    })
    .optional(),
);

function isPlainHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

/** localhost and the loopback addresses: nothing leaves the machine, so http is fine there. */
function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
}

/** The values of AI_PROVIDER: the shared tuple is the one source. */
export const AI_PROVIDER_NAMES = AI_PROVIDER_SETTINGS;

/** How a provider is asked for JSON. zod validates the answer whichever is used. */
export const AI_STRUCTURED_OUTPUTS = [
  "json_schema",
  "json_object",
  "prompt",
] as const;

/**
 * The JWT secret the API falls back to outside production, and the value
 * `.env.example` ships. It is public, so production refuses it.
 */
export const DEFAULT_JWT_SECRET =
  "local-development-secret-not-for-production-use";

/** The bank fingerprint key `.env.example` ships. It is public, so only a laptop may use it. */
export const LOCAL_BANK_FINGERPRINT_KEY =
  "local-development-bank-fingerprint-key-not-for-production-use";

/**
 * Every environment variable the API reads, with its safe default. A variable
 * with no default is required: the API refuses to start without it.
 *
 * Later stories add their own variables here and to the root `.env.example`.
 */
export const envSchema = z
  .object({
    // Required on purpose. A missing value must never fall back to `local`,
    // which has the loosest safety rules.
    APP_ENV: z.enum(APP_ENVS),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DEMO_MODE: booleanFlag.default(false),
    // The proposal demo's storyline order (PO 4471-26) in the generated data.
    DEMO_STORYLINE: booleanFlag.default(false),

    API_HOST: z.string().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    // How many reverse proxies sit in front of the API. Rate limiting and
    // logs read the client address through this many hops, never further.
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),

    CORS_ORIGINS: originList.default(["http://localhost:5173"]),

    RATE_LIMIT_WINDOW_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(3600)
      .default(60),
    RATE_LIMIT_MAX_REQUESTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(100_000)
      .default(300),

    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),

    // Off in production unless asked for. Decided after parsing.
    SWAGGER_ENABLED: booleanFlag.optional(),

    // PostgreSQL. Required: there is no default that would be right on every
    // machine, because the port comes from the root .env.
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\/\S+$/, "Must start with postgresql://"),

    // How often the workflow sweep sends what has come due. 0 switches it off.
    WORKFLOW_SWEEP_SECONDS: z.coerce.number().int().min(0).default(60),

    // Redis, with the database number at the end (redis://host:6379/0).
    REDIS_URL: z
      .string()
      .regex(/^rediss?:\/\/\S+$/, "Must start with redis://"),

    // Document storage over the S3 API. Leave S3_ENDPOINT out for AWS S3.
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET: z
      .string()
      .regex(
        /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
        "Must be a valid bucket name: 3 to 63 lower-case letters, digits, dots or hyphens",
      ),
    // MinIO needs path-style addressing. Decided after parsing: on when an
    // endpoint is set, unless said otherwise.
    S3_FORCE_PATH_STYLE: booleanFlag.optional(),
    S3_CREATE_BUCKET: booleanFlag.default(false),

    // Sessions (P-10). The secret signs the access token (HS256). Production
    // refuses the default and anything shorter than 32 characters.
    JWT_SECRET: z.string().min(32).default(DEFAULT_JWT_SECRET),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(1)
      .max(3600)
      .default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(2_592_000)
      .default(604_800),
    // Secure cookies. Only APP_ENV=local may turn it off, for plain http on
    // a laptop. Decided after parsing.
    COOKIE_SECURE: booleanFlag.default(true),
    // Sign-in attempts per client in each rate-limit window: stricter than
    // the rest of the API.
    AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce
      .number()
      .int()
      .min(1)
      .max(100_000)
      .default(20),
    // The password of every seeded account, for local and demo use only.
    // Without it the seeded accounts have no password.
    DEMO_PASSWORD: z.string().min(8).max(128).optional(),

    // Set by the image build (P-13). Shown by /health.
    GIT_SHA: z.string().min(1).optional(),

    // Monitoring (G-1). Each is off unless set (ADRs 0021, 0022 and 0028).
    // Traces and metrics go over OTLP/HTTP to this collector, such as http://127.0.0.1:4318.
    OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
    // /metrics answers only to this bearer token, and not at all without one.
    METRICS_TOKEN: z.string().min(24).optional(),
    // Errors go to Sentry only when this is set.
    SENTRY_DSN: z.url().optional(),

    // Keys the fingerprints of vendors' bank details (F-5), so a stolen table
    // cannot be reversed by guessing account numbers. Separate from the JWT
    // secret: rotating that must not make every vendor look changed. Without
    // it a comparison fails closed.
    BANK_FINGERPRINT_KEY: z.string().min(32).optional(),

    // The AI gateway (P-17). The default is the offline mock: no key, no
    // network. Only synthetic data may be sent to any other provider, and a
    // free-tier provider may keep and use what it is sent.
    AI_PROVIDER: z.preprocess(
      unsetWhenEmpty,
      z.enum(AI_PROVIDER_NAMES).default("mock"),
    ),
    GEMINI_API_KEY: optionalSecret,
    GROQ_API_KEY: optionalSecret,
    // For openai-compatible only: OpenRouter, NVIDIA NIM, Ollama and the like.
    // The gemini and groq presets know their own addresses.
    AI_BASE_URL: baseUrlText,
    AI_API_KEY: optionalSecret,
    // No model id has a default: ids change faster than releases do.
    AI_MODEL: optionalText,
    AI_VISION_MODEL: optionalText,
    AI_STRUCTURED_OUTPUT: z.preprocess(
      unsetWhenEmpty,
      z.enum(AI_STRUCTURED_OUTPUTS).default("json_schema"),
    ),
    AI_TIMEOUT_MS: boundedInt(1000, 300_000, 60_000),
    AI_MAX_ATTEMPTS: boundedInt(1, 5, 3),
    AI_MAX_TOOL_STEPS: boundedInt(1, 10, 5),
    AI_MAX_IMAGES_PER_REQUEST: boundedInt(1, 10, 3),
    AI_MAX_OUTPUT_TOKENS: boundedInt(1, 131_072, 4096),
    // Prices drift, so they are configuration and the cost is an estimate.
    AI_PRICE_INPUT_USD_PER_MTOK: priceText,
    AI_PRICE_OUTPUT_USD_PER_MTOK: priceText,
    // Bedrock reads no ambient credentials: AppConfig is the only reader of
    // the environment.
    AI_BEDROCK_REGION: optionalText,
    AI_BEDROCK_ACCESS_KEY_ID: optionalSecret,
    AI_BEDROCK_SECRET_ACCESS_KEY: optionalSecret,
    AI_BEDROCK_SESSION_TOKEN: optionalSecret,
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "local" && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "Cookies must be Secure unless APP_ENV is local",
      });
    }
    // The default is public, and anyone who can sign a token can be anyone.
    // A demo stack is reachable by others, so only a laptop may use it.
    if (env.APP_ENV !== "local" && env.JWT_SECRET === DEFAULT_JWT_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["JWT_SECRET"],
        message:
          "Set your own JWT secret unless APP_ENV is local: the default is public",
      });
    }
    if (
      env.APP_ENV !== "local" &&
      env.BANK_FINGERPRINT_KEY === LOCAL_BANK_FINGERPRINT_KEY
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["BANK_FINGERPRINT_KEY"],
        message:
          "Set your own bank fingerprint key unless APP_ENV is local: this one is public",
      });
    }
    requireAiSettings(env, ctx);
    if (env.APP_ENV !== "production") return;
    if (env.DEMO_PASSWORD !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["DEMO_PASSWORD"],
        message: "Demo passwords are for local and demo use, not production",
      });
    }
    if (env.DEMO_MODE) {
      ctx.addIssue({
        code: "custom",
        path: ["DEMO_MODE"],
        message: "Demo mode must be false when APP_ENV is production",
      });
    }
    if (env.CORS_ORIGINS.some((origin) => origin.startsWith("http://"))) {
      ctx.addIssue({
        code: "custom",
        path: ["CORS_ORIGINS"],
        message: "Production origins must use https",
      });
    }
  });

export type Env = z.output<typeof envSchema>;

/**
 * A chosen provider needs its own settings. Each message names the variable
 * and the file to put it in, and never a value: a key may be what is wrong.
 */
function requireAiSettings(env: Env, ctx: z.core.$RefinementCtx): void {
  const need = (name: keyof typeof env, why: string): void => {
    if (env[name] !== undefined) return;
    ctx.addIssue({
      code: "custom",
      path: [name],
      message: `Set it in the root .env file: ${why}`,
    });
  };
  switch (env.AI_PROVIDER) {
    case "mock":
      return;
    case "gemini":
      need("GEMINI_API_KEY", "AI_PROVIDER is gemini");
      need("AI_MODEL", "AI_PROVIDER is gemini and no model id is assumed");
      return;
    case "groq":
      need("GROQ_API_KEY", "AI_PROVIDER is groq");
      need("AI_MODEL", "AI_PROVIDER is groq and no model id is assumed");
      return;
    case "openai-compatible":
      need("AI_BASE_URL", "AI_PROVIDER is openai-compatible");
      need(
        "AI_MODEL",
        "AI_PROVIDER is openai-compatible and no model id is assumed",
      );
      if (env.APP_ENV === "production" && env.AI_BASE_URL !== undefined) {
        const url = new URL(env.AI_BASE_URL);
        if (url.protocol !== "https:" && !isLoopbackHost(url.hostname)) {
          ctx.addIssue({
            code: "custom",
            path: ["AI_BASE_URL"],
            message:
              "Production must reach the provider over https, unless it runs on this machine",
          });
        }
      }
      return;
    case "bedrock":
      need("AI_BEDROCK_REGION", "AI_PROVIDER is bedrock");
      need("AI_BEDROCK_ACCESS_KEY_ID", "AI_PROVIDER is bedrock");
      need("AI_BEDROCK_SECRET_ACCESS_KEY", "AI_PROVIDER is bedrock");
      need("AI_MODEL", "AI_PROVIDER is bedrock and no model id is assumed");
      return;
  }
}
