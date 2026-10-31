// What `pnpm dev` compares to decide whether the API needs a restart.
//
// A watcher event is not proof that a file changed. On Windows with NTFS
// last-access updates on (the default on most machines), merely reading a file
// fires a "change" event, so `node --watch` restarted the API every time it
// loaded a module it had not read that hour. A file has really changed only
// when its last-write time (mtime) or size does.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The JavaScript files under each folder, with their last-write time and size.
 * A folder that does not exist yet counts as empty.
 *
 * @param {string[]} folders
 * @returns {Map<string, string>}
 */
export function snapshot(folders) {
  /** @type {Map<string, string>} */
  const files = new Map();
  /** @param {string} folder */
  const walk = (folder) => {
    let entries;
    try {
      entries = readdirSync(folder, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(folder, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".js")) {
        try {
          const stat = statSync(path);
          files.set(path, `${stat.mtimeMs}:${stat.size}`);
        } catch {
          // Removed while we looked: the next snapshot will not list it.
        }
      }
    }
  };
  for (const folder of folders) walk(folder);
  return files;
}

/**
 * The files that were added, removed or rewritten.
 *
 * @param {Map<string, string>} before
 * @param {Map<string, string>} after
 * @returns {string[]}
 */
export function changedFiles(before, after) {
  const changed = [];
  for (const [path, version] of after) {
    if (before.get(path) !== version) changed.push(path);
  }
  for (const path of before.keys()) {
    if (!after.has(path)) changed.push(path);
  }
  return changed;
}
