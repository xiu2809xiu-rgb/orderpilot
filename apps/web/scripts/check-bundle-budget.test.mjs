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
import { moduleName } from "../bundle-report.ts";
import {
  BUDGET_BYTES,
  findPlannedText,
  initialScripts,
  isOwnCode,
  measureInitialJs,
  moduleSizes,
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

  it("shares each file's gzip size among its modules and adds them up", () => {
    const files = [
      { file: "assets/index-abc.js", gzipBytes: 1000 },
      { file: "assets/vendor-def.js", gzipBytes: 600 },
    ];
    const report = {
      "assets/index-abc.js": [
        { module: "apps/web/src/main.tsx", weight: 1 },
        { module: "react-dom/client.js", weight: 3 },
      ],
      "assets/vendor-def.js": [{ module: "react-dom/client.js", weight: 9 }],
      "assets/lazy-xyz.js": [{ module: "cmdk/index.js", weight: 50 }],
    };
    expect(moduleSizes(files, report)).toEqual([
      { module: "react-dom/client.js", gzipBytes: 1350 },
      { module: "apps/web/src/main.tsx", gzipBytes: 250 },
    ]);
  });

  it("has no module sizes when the report is from another build", () => {
    const files = [{ file: "assets/index-new.js", gzipBytes: 10 }];
    expect(moduleSizes(files, { "assets/index-old.js": [] })).toBeNull();
  });

  it("tells our own code from a package's", () => {
    expect(isOwnCode("apps/web/src/app/shell/AppShell.tsx")).toBe(true);
    expect(isOwnCode("packages/shared/src/roles.ts")).toBe(true);
    expect(isOwnCode("react-dom/cjs/react-dom-client.production.js")).toBe(
      false,
    );
  });

  it("names a module by its package path or its repository path", () => {
    const root = "C:/repo";
    expect(
      moduleName(
        String.raw`C:\repo\node_modules\.pnpm\react@19\node_modules\react\index.js`,
        root,
      ),
    ).toBe("react/index.js");
    expect(moduleName("C:/repo/apps/web/src/main.tsx?v=1", root)).toBe(
      "apps/web/src/main.tsx",
    );
    expect(moduleName("\u0000rolldown/runtime.js", root)).toBe(
      "rolldown/runtime.js",
    );
  });
});

describe("developers-only text", () => {
  const planned = {
    badge: "Planned",
    lists: { a: ["A sentence that is long enough"] },
  };

  it("is found in a build that contains it, and only there", () => {
    const dist = mkdtempSync(path.join(tmpdir(), "op-planned-"));
    mkdirSync(path.join(dist, "assets"));
    writeFileSync(path.join(dist, "assets/clean.js"), 'x="Planned";y=1');
    expect(findPlannedText(dist, planned)).toEqual([]);
    const leak = path.join(dist, "assets/leak.js");
    writeFileSync(leak, 'x="A sentence that is long enough"');
    expect(findPlannedText(dist, planned)).toEqual([leak]);
  });
});
