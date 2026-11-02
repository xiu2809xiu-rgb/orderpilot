import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { Plugin } from "vite";

/**
 * Writes which modules each chunk holds, and a weight for each, to the Vite
 * cache folder, so `pnpm budget` can name what fills the entry chunk. It stays
 * out of dist: the image serves dist, and nobody needs this there.
 */
export const BUNDLE_REPORT = "bundle-report.json";

/** Every chunk's modules: a readable name and its gzipped source size. */
export type BundleReport = Record<string, { module: string; weight: number }[]>;

/** The package path for a dependency, the repository path for our code. */
export function moduleName(id: string, repoRoot: string): string {
  // Virtual modules start with a NUL byte, and some ids carry a query.
  const clean = id
    .replace(/^\0/, "")
    .replace(/\?.*$/, "")
    .replaceAll("\\", "/");
  const inPackage = clean.lastIndexOf("/node_modules/");
  if (inPackage >= 0) return clean.slice(inPackage + "/node_modules/".length);
  const root = repoRoot.replaceAll("\\", "/");
  return clean.startsWith(`${root}/`) ? clean.slice(root.length + 1) : clean;
}

export function bundleReport(repoRoot: string): Plugin {
  let cacheDir = "";
  return {
    name: "orderpilot-bundle-report",
    apply: "build",
    configResolved(config) {
      cacheDir = config.cacheDir;
    },
    generateBundle(_options, bundle) {
      const report: BundleReport = {};
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        report[chunk.fileName] = Object.entries(chunk.modules)
          .map(([id, rendered]) => ({
            module: moduleName(id, repoRoot),
            weight: rendered.code
              ? gzipSync(rendered.code).length
              : rendered.renderedLength,
          }))
          .filter((entry) => entry.weight > 0);
      }
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(path.join(cacheDir, BUNDLE_REPORT), JSON.stringify(report));
    },
  };
}
