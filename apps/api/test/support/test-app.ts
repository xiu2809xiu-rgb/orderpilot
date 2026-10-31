import "reflect-metadata";
import type { INestApplicationContext, Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { AppModule } from "../../src/app.module.js";
import { configureApp } from "../../src/bootstrap/configure-app.js";
import { AppConfig } from "../../src/config/app-config.js";
import { testInfrastructureEnv } from "./infrastructure.js";
import { testConfig } from "./reset.js";

/**
 * A valid environment for tests, pointing at the test database, the test Redis
 * database and the test bucket. The vitest config loads the root .env, which
 * builds the TEST_* values from the same ports as the development stack.
 */
export function testEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...testInfrastructureEnv(),
    APP_ENV: "local",
    NODE_ENV: "test",
    LOG_LEVEL: "info",
    CORS_ORIGINS: "http://localhost:5173",
    DEMO_MODE: "true",
    COOKIE_SECURE: "false",
    // High enough that no test hits the sign-in limiter by accident.
    AUTH_RATE_LIMIT_MAX_REQUESTS: "10000",
    // High enough that no test hits the limiter by accident.
    RATE_LIMIT_MAX_REQUESTS: "10000",
    ...overrides,
  };
}

export interface TestApp {
  readonly app: NestExpressApplication;
  readonly config: AppConfig;
  /** Every log line written so far, parsed. */
  readonly logLines: () => Record<string, unknown>[];
  readonly close: () => Promise<void>;
}

/**
 * Boots the real app through the same configureApp that main.ts calls, with
 * its log lines captured. Extra controllers let a test add a route that fails
 * on purpose.
 */
export async function createTestApp(
  env: NodeJS.ProcessEnv = {},
  controllers: Type[] = [],
  /** Swap a provider, such as the PermissionPolicy, before the app is built. */
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestApp> {
  const config = AppConfig.fromEnv(testEnv(env));
  const chunks: string[] = [];
  const moduleRef = await override(
    Test.createTestingModule({
      imports: [AppModule.register(config)],
      controllers,
    }),
  ).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  await configureApp(app, config, {
    logStream: {
      write: (line: string) => {
        chunks.push(line);
      },
    },
  });
  return {
    app,
    config,
    logLines: () =>
      chunks
        .join("")
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
    close: () => app.close(),
  };
}

export interface TestContext {
  readonly app: INestApplicationContext;
  readonly close: () => Promise<void>;
}

/**
 * The whole module graph without an HTTP server, for tests of services,
 * repositories, the queue and the storage. Connected to the test database,
 * Redis database and bucket.
 */
export async function createTestContext(): Promise<TestContext> {
  const app = await NestFactory.createApplicationContext(
    AppModule.register(testConfig()),
    { logger: false },
  );
  return { app, close: () => app.close() };
}
