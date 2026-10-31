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
 * The JWT secret the API falls back to outside production, and the value
 * `.env.example` ships. It is public, so production refuses it.
 */
export const DEFAULT_JWT_SECRET =
  "local-development-secret-not-for-production-use";

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
