import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { configureApp } from "./bootstrap/configure-app.js";
import { AppConfig } from "./config/app-config.js";
import { ConfigError } from "./config/config-error.js";
import {
  ENV_FILES,
  ROOT_ENV_FILE,
  loadEnvFiles,
} from "./config/load-env-files.js";
import { initSentry } from "./telemetry/sentry.js";
import { initTelemetry } from "./telemetry/telemetry.js";

async function bootstrap(): Promise<void> {
  loadEnvFiles();
  const config = AppConfig.fromEnv(process.env, {
    createFile: ROOT_ENV_FILE,
    readFiles: ENV_FILES,
  });

  // Before anything else runs, so the first request already has a trace id.
  // Both are off at the edge unless configured: see ADRs 0021 and 0022.
  initSentry(config);
  const telemetry = initTelemetry(config);

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config),
    { bufferLogs: true },
  );
  await configureApp(app, config);
  app.enableShutdownHooks();
  // Spans and metrics still in the queue are sent before the process ends.
  process.once("SIGTERM", () => void telemetry.shutdown());
  await app.listen(config.http.port, config.http.host);
}

try {
  await bootstrap();
} catch (error) {
  if (error instanceof ConfigError) {
    // A person fixes this by reading it: no stack trace.
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
