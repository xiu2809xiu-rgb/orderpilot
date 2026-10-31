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

    // Set by the image build (P-13). Shown by /health.
    GIT_SHA: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV !== "production") return;
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
