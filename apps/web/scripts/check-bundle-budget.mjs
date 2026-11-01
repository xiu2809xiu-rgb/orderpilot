// The bundle budget: the JavaScript a first visit downloads, gzipped, stays at
// 250 KB or less. "Initial" means what index.html loads up front: its module
// script and its modulepreload links. Route chunks and the 3D chunks (P-23)
// load later, on demand, so they are outside the budget by design.
//
// It also names the largest modules in the initial files, overall and of our
// own code, so a story that grows the entry sees why. The module list comes
// from the report bundle-report.ts writes at build time.
//
// Usage: node scripts/check-bundle-budget.mjs [distDir] [--files]

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const BUDGET_BYTES = 250_000;
export const TOP = 5;

// Vite's cache folder, where bundle-report.ts writes. Not dist: dist is served.
const REPORT = path.join(
  import.meta.dirname,
  "../node_modules/.vite/bundle-report.json",
);

/** The JS files index.html loads at start-up, as paths relative to dist. */
export function initialScripts(html) {
  const found = new Set();
  const tags = html.match(/<(?:script|link)\b[^>]*>/g) ?? [];
  for (const tag of tags) {
    const isScript = tag.startsWith("<script") && /type="module"/.test(tag);
    const isPreload = /rel="modulepreload"/.test(tag);
    if (!isScript && !isPreload) continue;
    const src = /(?:src|href)="([^"]+)"/.exec(tag)?.[1];
    if (src?.endsWith(".js")) found.add(src.replace(/^\//, ""));
  }
  return [...found];
}

export function measureInitialJs(distDir) {
  const html = readFileSync(path.join(distDir, "index.html"), "utf8");
  const files = initialScripts(html).map((file) => ({
    file,
    gzipBytes: gzipSync(readFileSync(path.join(distDir, file))).length,
  }));
  const total = files.reduce((sum, entry) => sum + entry.gzipBytes, 0);
  return { files, total };
}

/**
 * Shares each initial file's real gzip size among its modules by their
 * weights, then adds up each module across files. The result is an estimate:
 * gzip works on the whole file, not module by module. Returns null when the
 * report does not describe these files (it is from another build).
 */
export function moduleSizes(files, report) {
  const sizes = new Map();
  for (const { file, gzipBytes } of files) {
    const modules = report[file];
    if (!modules) return null;
    const weight = modules.reduce((sum, entry) => sum + entry.weight, 0);
    for (const entry of modules) {
      const share = weight > 0 ? (gzipBytes * entry.weight) / weight : 0;
      sizes.set(entry.module, (sizes.get(entry.module) ?? 0) + share);
    }
  }
  return [...sizes]
    .map(([module, gzipBytes]) => ({ module, gzipBytes }))
    .sort((a, b) => b.gzipBytes - a.gzipBytes);
}

/** Modules from this repository, not from a package. */
export function isOwnCode(module) {
  return !module.includes("node_modules") && /^(apps|packages)\//.test(module);
}

function kb(bytes) {
  return `${(bytes / 1000).toFixed(1)} KB`;
}

function readReport() {
  if (!existsSync(REPORT)) return null;
  try {
    return JSON.parse(readFileSync(REPORT, "utf8"));
  } catch {
    return null;
  }
}

function printModules(title, list) {
  console.log(title);
  for (const { module, gzipBytes } of list.slice(0, TOP)) {
    console.log(`  ${kb(gzipBytes).padStart(8)}  ${module}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const dist = path.resolve(
    args.find((arg) => !arg.startsWith("--")) ?? "dist",
  );
  const { files, total } = measureInitialJs(dist);
  if (files.length === 0) {
    console.error(`No initial scripts found in ${dist}/index.html.`);
    process.exit(1);
  }
  if (args.includes("--files")) {
    for (const { file, gzipBytes } of files) {
      console.log(`  ${file}: ${kb(gzipBytes)} gzip`);
    }
  }
  const over = total > BUDGET_BYTES;
  const margin = over
    ? `OVER the ${kb(BUDGET_BYTES)} budget by ${kb(total - BUDGET_BYTES)}`
    : `within the ${kb(BUDGET_BYTES)} budget, ${kb(BUDGET_BYTES - total)} to spare`;
  console.log(
    `Initial JS: ${kb(total)} gzip in ${String(files.length)} files, ${margin}.`,
  );

  const report = readReport();
  const sizes = report ? moduleSizes(files, report) : null;
  if (sizes) {
    printModules("Largest modules in it (gzip, estimated):", sizes);
    printModules(
      "Largest of our own code:",
      sizes.filter((entry) => isOwnCode(entry.module)),
    );
  } else {
    console.log(
      "Module sizes: none for this build. Run pnpm build, then pnpm budget.",
    );
  }
  if (over) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
