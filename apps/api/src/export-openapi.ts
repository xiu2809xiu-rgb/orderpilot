import "reflect-metadata";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { buildOpenApiDocument } from "./bootstrap/openapi-document.js";
import { applyRouting } from "./bootstrap/routing.js";
import { AppConfig } from "./config/app-config.js";

/**
 * `pnpm api:spec`: writes the OpenAPI document to a file. `preview: true`
 * builds the module graph and registers the routes without creating a single
 * provider, so nothing connects to a database, Redis or storage, and no .env
 * is read. The configuration is fixed on purpose: the file must not depend on
 * the machine that wrote it.
 */
const target = path.resolve(process.argv[2] ?? "openapi.json");
const version = (
  JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;

// Made-up values: the config requires them, but with `preview: true` nothing
// connects to them.
const config = AppConfig.fromEnv({
  APP_ENV: "local",
  // On, so the document lists the demo sign-in. A running API with DEMO_MODE
  // off does not serve that one route.
  DEMO_MODE: "true",
  DATABASE_URL: "postgresql://spec:spec@127.0.0.1:5999/spec",
  REDIS_URL: "redis://127.0.0.1:5998/0",
  S3_ACCESS_KEY_ID: "spec",
  S3_SECRET_ACCESS_KEY: "spec",
  S3_BUCKET: "spec",
});
const app = await NestFactory.create<NestExpressApplication>(
  AppModule.register(config),
  { preview: true, logger: false },
);
applyRouting(app);
const document = buildOpenApiDocument(app, version);

mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
await app.close();
process.stdout.write(`Wrote ${target}\n`);
