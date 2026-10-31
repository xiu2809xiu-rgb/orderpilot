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

const config = AppConfig.fromEnv({ APP_ENV: "local" });
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
