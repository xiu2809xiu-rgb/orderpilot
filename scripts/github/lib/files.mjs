import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export function repoPath(relativePath) {
  return join(REPO_ROOT, relativePath);
}

export function readRepoFile(relativePath) {
  return readFileSync(repoPath(relativePath), "utf8");
}

export function readRepoJson(relativePath) {
  return JSON.parse(readRepoFile(relativePath));
}
