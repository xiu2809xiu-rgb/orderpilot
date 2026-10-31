import "reflect-metadata";
import type { Type } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module.js";
import { configureApp } from "../../src/bootstrap/configure-app.js";
import { AppConfig } from "../../src/config/app-config.js";

/** A valid environment for tests. Nothing here is read from a file or the shell. */
export function testEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    APP_ENV: "local",
    NODE_ENV: "test",
    LOG_LEVEL: "info",
    CORS_ORIGINS: "http://localhost:5173",
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
): Promise<TestApp> {
  const config = AppConfig.fromEnv(testEnv(env));
  const chunks: string[] = [];
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.register(config)],
    controllers,
  }).compile();
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
