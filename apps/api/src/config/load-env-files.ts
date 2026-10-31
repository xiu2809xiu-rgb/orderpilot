import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { expand } from "dotenv-expand";

/** The repository root, found from this file: src/config or dist/config, two folders under apps/api. */
const API_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const REPO_ROOT = resolve(API_ROOT, "../..");

/** First read, first to win. */
export const ENV_FILES: readonly string[] = [
  resolve(API_ROOT, ".env"),
  resolve(REPO_ROOT, ".env"),
];

/** The one file a newcomer creates. */
export const ROOT_ENV_FILE = resolve(REPO_ROOT, ".env");

/**
 * Loads the env files into `env`, in order. A value already in `env` (set by
 * the shell, CI or Docker) always wins, and so does an earlier file over a
 * later one. A missing file is skipped without a word.
 *
 * Values may refer to each other (`${POSTGRES_PORT}`), also across files and
 * to the shell, so one port line can move every URL built from it.
 *
 * Returns the files that were read.
 */
export function loadEnvFiles(
  env: NodeJS.ProcessEnv = process.env,
  files: readonly string[] = ENV_FILES,
): string[] {
  const read: string[] = [];
  const fromFiles: Record<string, string> = {};
  for (const file of files) {
    if (!existsSync(file)) continue;
    read.push(file);
    for (const [key, value] of Object.entries(
      parse(readFileSync(file, "utf8")),
    )) {
      // An earlier file already set it.
      if (!(key in fromFiles)) fromFiles[key] = value;
    }
  }
  // Only keys the shell has not set go in. dotenv-expand treats an empty
  // shell value as unset, so an empty value is kept out of its hands here.
  const parsed: Record<string, string> = {};
  for (const [key, value] of Object.entries(fromFiles)) {
    if (!(key in env)) parsed[key] = value;
  }
  const result = expand({ processEnv: env as Record<string, string>, parsed });
  if (result.error) throw result.error;
  return read;
}
