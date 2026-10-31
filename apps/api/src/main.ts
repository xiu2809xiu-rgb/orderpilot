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

async function bootstrap(): Promise<void> {
  loadEnvFiles();
  const config = AppConfig.fromEnv(process.env, {
    createFile: ROOT_ENV_FILE,
    readFiles: ENV_FILES,
  });

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(config),
    { bufferLogs: true },
  );
  await configureApp(app, config);
  app.enableShutdownHooks();
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
