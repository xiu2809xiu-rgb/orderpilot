import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUDGET_BYTES,
  initialScripts,
  measureInitialJs,
} from "./check-bundle-budget.mjs";

const fixture = path.join(import.meta.dirname, "fixtures/budget-index.html");
const html = readFileSync(fixture, "utf8");

describe("bundle budget", () => {
  it("counts only the module script and preloads as initial", () => {
    expect(initialScripts(html)).toEqual([
      "assets/index-abc.js",
      "assets/vendor-def.js",
    ]);
  });

  it("sums gzip sizes of the initial files and ignores other chunks", () => {
    const dist = mkdtempSync(path.join(tmpdir(), "op-budget-"));
    mkdirSync(path.join(dist, "assets"));
    copyFileSync(fixture, path.join(dist, "index.html"));
    writeFileSync(path.join(dist, "assets/index-abc.js"), "a".repeat(5000));
    writeFileSync(path.join(dist, "assets/vendor-def.js"), "b".repeat(5000));
    writeFileSync(path.join(dist, "assets/three-lazy.js"), "c".repeat(900_000));
    const { files, total } = measureInitialJs(dist);
    expect(files).toHaveLength(2);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThan(BUDGET_BYTES);
  });

  it("is over budget for a big initial chunk", () => {
    const dist = mkdtempSync(path.join(tmpdir(), "op-budget-"));
    mkdirSync(path.join(dist, "assets"));
    copyFileSync(fixture, path.join(dist, "index.html"));
    // Random-looking bytes do not compress, so this is over 250 KB gzipped.
    const noise = randomBytes(400_000);
    writeFileSync(path.join(dist, "assets/index-abc.js"), noise);
    writeFileSync(path.join(dist, "assets/vendor-def.js"), "x");
    expect(measureInitialJs(dist).total).toBeGreaterThan(BUDGET_BYTES);
  });
});
