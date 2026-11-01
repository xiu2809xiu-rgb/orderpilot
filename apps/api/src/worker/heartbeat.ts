import { mkdirSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * The worker has no HTTP port. It says it is healthy by touching this file
 * while it can reach Redis, and the image's health check reads the file's age.
 * A file keeps the process free of a second server and of a port to configure.
 */
export const HEARTBEAT_FILE = join(tmpdir(), "orderpilot-worker-heartbeat");

/** How often the worker beats, and how old a beat may be before the worker counts as down. */
export const HEARTBEAT_INTERVAL_MS = 10_000;
export const HEARTBEAT_MAX_AGE_MS = 30_000;

export function beat(file: string = HEARTBEAT_FILE, now = new Date()): void {
  try {
    utimesSync(file, now, now);
  } catch {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${now.toISOString()}\n`);
  }
}

/** False when the file is missing or older than `maxAgeMs`. */
export function isFresh(
  file: string = HEARTBEAT_FILE,
  maxAgeMs: number = HEARTBEAT_MAX_AGE_MS,
  now = Date.now(),
): boolean {
  try {
    return now - statSync(file).mtimeMs <= maxAgeMs;
  } catch {
    return false;
  }
}
