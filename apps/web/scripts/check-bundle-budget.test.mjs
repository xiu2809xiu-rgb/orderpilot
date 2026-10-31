import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUDGET_BYTES,
  initialScripts,
  measureInitialJs,
} from "./check-bundle-budget.mjs";

const html = `<!doctype html><html><head>
<script type="module" crossorigin src="/assets/index-abc.js"></script>
<link rel="modulepreload" crossorigin href="/assets/vendor-def.js">
<link rel="stylesheet" crossorigin href="/assets/index-abc.css">
<script src="/theme-init.js"></script>
</head><body></body></html>`;

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
    writeFileSync(path.join(dist, "index.html"), html);
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
    writeFileSync(path.join(dist, "index.html"), html);
    // Random-looking bytes do not compress, so this is over 250 KB gzipped.
    const noise = randomBytes(400_000);
    writeFileSync(path.join(dist, "assets/index-abc.js"), noise);
    writeFileSync(path.join(dist, "assets/vendor-def.js"), "x");
    expect(measureInitialJs(dist).total).toBeGreaterThan(BUDGET_BYTES);
  });
});
