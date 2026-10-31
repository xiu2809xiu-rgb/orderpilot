import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { changedFiles, snapshot } from "./dist-snapshot.mjs";

let dir = "";
let file = "";

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "op-snapshot-"));
  file = join(dir, "main.js");
  writeFileSync(file, "one");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("dist snapshot", () => {
  it("does not see a read, which only moves the last-access time", () => {
    const written = new Date("2026-01-01T00:00:00Z");
    utimesSync(file, written, written);
    const before = snapshot([dir]);
    // A read moves only the access time; the write time stays.
    utimesSync(file, new Date(), written);
    expect(changedFiles(before, snapshot([dir])).length).toBe(0);
  });

  it("sees a rewrite, a new file and a removed file", () => {
    const before = snapshot([dir]);
    writeFileSync(file, "two, longer");
    expect(changedFiles(before, snapshot([dir])).length).toBeGreaterThan(0);

    const second = snapshot([dir]);
    writeFileSync(join(dir, "other.js"), "x");
    expect(changedFiles(second, snapshot([dir])).length).toBeGreaterThan(0);

    const third = snapshot([dir]);
    rmSync(join(dir, "other.js"));
    expect(changedFiles(third, snapshot([dir])).length).toBeGreaterThan(0);
  });

  it("ignores files that are not JavaScript, and folders that do not exist", () => {
    const before = snapshot([dir, join(dir, "missing")]);
    writeFileSync(join(dir, "notes.tsbuildinfo"), "x");
    const after = snapshot([dir, join(dir, "missing")]);
    expect(changedFiles(before, after)).toEqual([]);
  });
});
