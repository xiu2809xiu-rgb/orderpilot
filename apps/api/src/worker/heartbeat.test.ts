import { mkdtempSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HEARTBEAT_MAX_AGE_MS, beat, isFresh } from "./heartbeat.js";

describe("worker heartbeat", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "op-heartbeat-"));
    file = join(dir, "beat");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("is not healthy before the first beat", () => {
    expect(isFresh(file)).toBe(false);
  });

  it("is healthy right after a beat", () => {
    beat(file);
    expect(isFresh(file)).toBe(true);
  });

  it("turns unhealthy once the last beat is older than the maximum age", () => {
    beat(file);
    const stale = new Date(Date.now() - HEARTBEAT_MAX_AGE_MS - 5_000);
    utimesSync(file, stale, stale);
    expect(isFresh(file)).toBe(false);
  });

  it("is healthy again after a new beat", () => {
    beat(file);
    const stale = new Date(Date.now() - HEARTBEAT_MAX_AGE_MS - 5_000);
    utimesSync(file, stale, stale);
    beat(file);
    expect(isFresh(file)).toBe(true);
  });
});
