/**
 * A complete, valid environment made of made-up values. For tests of the
 * configuration and for tests that never connect to anything. Nothing here is
 * read from a file or the shell, and no real service answers on these ports.
 */
export function baseEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: "local",
    DATABASE_URL: "postgresql://user:pass@127.0.0.1:5999/unit",
    REDIS_URL: "redis://127.0.0.1:5998/0",
    S3_ENDPOINT: "http://127.0.0.1:5997",
    S3_ACCESS_KEY_ID: "unit-key",
    S3_SECRET_ACCESS_KEY: "unit-secret",
    S3_BUCKET: "unit-bucket",
    ...overrides,
  };
}
