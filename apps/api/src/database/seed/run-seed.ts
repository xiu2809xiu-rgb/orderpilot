import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module.js";
import type { AppConfig } from "../../config/app-config.js";
import { SEEDERS } from "./seeders.js";

/**
 * Runs every seeder against the database, Redis and storage that `config`
 * names, through the same modules the API uses. Safe to run again.
 */
export async function runSeed(
  config: AppConfig,
  log: (line: string) => void = () => undefined,
): Promise<void> {
  const app = await NestFactory.createApplicationContext(
    AppModule.register(config),
    { logger: false },
  );
  try {
    for (const seeder of SEEDERS) {
      log(`seed ${seeder.name}: ${await seeder.run(app)}`);
    }
  } finally {
    await app.close();
  }
}
