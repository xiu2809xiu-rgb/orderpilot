// The bundle budget: the JavaScript a first visit downloads, gzipped, stays at
// 250 KB or less. "Initial" means what index.html loads up front: its module
// script and its modulepreload links. Route chunks and the 3D chunks (P-23)
// load later, on demand, so they are outside the budget by design.
//
// It also checks that the developers-only text of unbuilt screens
// (src/locales/en/planned.json) is in no file of the build.
//
// Usage: node scripts/check-bundle-budget.mjs [distDir]

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const BUDGET_BYTES = 250_000;

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

/** Every string of 20 characters or more in planned.json, which only a dev build loads. */
export function plannedSentences(json) {
  const found = [];
  const walk = (value) => {
    if (typeof value === "string") {
      if (value.length >= 20) found.push(value);
    } else if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(json);
  return found;
}

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? filesUnder(path.join(dir, entry.name))
      : [path.join(dir, entry.name)],
  );
}

/** The files of a build that contain text meant for developers only. */
export function findPlannedText(distDir, plannedJson) {
  const sentences = plannedSentences(plannedJson);
  return filesUnder(distDir).filter((file) => {
    if (!/\.(js|json|html|css)$/.test(file)) return false;
    const text = readFileSync(file, "utf8");
    return sentences.some((sentence) => text.includes(sentence));
  });
}

function kb(bytes) {
  return `${(bytes / 1000).toFixed(1)} KB`;
}

function main() {
  const dist = path.resolve(process.argv[2] ?? "dist");
  const { files, total } = measureInitialJs(dist);
  if (files.length === 0) {
    console.error(`No initial scripts found in ${dist}/index.html.`);
    process.exit(1);
  }
  for (const { file, gzipBytes } of files) {
    console.log(`  ${file}: ${kb(gzipBytes)} gzip`);
  }
  const verdict = total <= BUDGET_BYTES ? "within" : "OVER";
  console.log(
    `Initial JS: ${kb(total)} gzip, ${verdict} the ${kb(BUDGET_BYTES)} budget.`,
  );
  const planned = JSON.parse(
    readFileSync(
      path.resolve(import.meta.dirname, "../src/locales/en/planned.json"),
      "utf8",
    ),
  );
  const leaks = findPlannedText(dist, planned);
  console.log(
    leaks.length === 0
      ? "No developers-only text in the build."
      : `Developers-only text found in: ${leaks.join(", ")}`,
  );
  if (total > BUDGET_BYTES || leaks.length > 0) process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
