import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnvFiles } from "./load-env-files.js";

describe("loadEnvFiles", () => {
  let dir: string;
  let apiFile: string;
  let rootFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "op-env-"));
    apiFile = join(dir, "api.env");
    rootFile = join(dir, "root.env");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("skips files that do not exist, quietly", () => {
    const env: NodeJS.ProcessEnv = { KEPT: "yes" };
    expect(loadEnvFiles(env, [apiFile, rootFile])).toEqual([]);
    expect(env).toEqual({ KEPT: "yes" });
  });

  it("loads the root file when it is the only one", () => {
    writeFileSync(rootFile, "APP_ENV=local\nAPI_PORT=3100\n");
    const env: NodeJS.ProcessEnv = {};
    expect(loadEnvFiles(env, [apiFile, rootFile])).toEqual([rootFile]);
    expect(env).toEqual({ APP_ENV: "local", API_PORT: "3100" });
  });

  it("lets apps/api/.env win over the root .env", () => {
    writeFileSync(apiFile, "API_PORT=4000\n");
    writeFileSync(rootFile, "API_PORT=3000\nAPP_ENV=local\n");
    const env: NodeJS.ProcessEnv = {};
    loadEnvFiles(env, [apiFile, rootFile]);
    expect(env).toEqual({ API_PORT: "4000", APP_ENV: "local" });
  });

  it("never overrides what the shell, CI or Docker set, not even with an empty value", () => {
    writeFileSync(rootFile, "API_PORT=3000\nAPP_ENV=local\nLOG_LEVEL=debug\n");
    const env: NodeJS.ProcessEnv = { API_PORT: "9999", LOG_LEVEL: "" };
    loadEnvFiles(env, [rootFile]);
    expect(env).toEqual({ API_PORT: "9999", LOG_LEVEL: "", APP_ENV: "local" });
  });

  it("expands ${VARIABLE}, so one port line moves every URL built from it", () => {
    writeFileSync(
      rootFile,
      "POSTGRES_PORT=5432\nDATABASE_URL=postgresql://op@localhost:${POSTGRES_PORT}/op\n",
    );
    const env: NodeJS.ProcessEnv = {};
    loadEnvFiles(env, [rootFile]);
    expect(env.DATABASE_URL).toBe("postgresql://op@localhost:5432/op");
  });

  it("expands across files, and from the shell", () => {
    writeFileSync(apiFile, "REDIS_URL=redis://localhost:${REDIS_PORT}\n");
    writeFileSync(
      rootFile,
      "REDIS_PORT=6379\nMINIO_URL=http://${MINIO_HOST}:9000\n",
    );
    const env: NodeJS.ProcessEnv = { MINIO_HOST: "storage.test" };
    loadEnvFiles(env, [apiFile, rootFile]);
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
    expect(env.MINIO_URL).toBe("http://storage.test:9000");
  });

  it("uses the shell's value when a URL refers to a port the shell moved", () => {
    writeFileSync(
      rootFile,
      "POSTGRES_PORT=5432\nDATABASE_URL=postgresql://op@localhost:${POSTGRES_PORT}/op\n",
    );
    const env: NodeJS.ProcessEnv = { POSTGRES_PORT: "5433" };
    loadEnvFiles(env, [rootFile]);
    expect(env.DATABASE_URL).toBe("postgresql://op@localhost:5433/op");
  });
});
