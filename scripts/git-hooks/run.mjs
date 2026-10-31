// Shared steps for the Git hooks in .githooks/. Each hook is a two-line sh
// script that calls one of these files, so the logic is plain Node and runs
// the same in Git Bash on Windows and in sh on macOS and Linux.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** The repository these hook scripts belong to. */
export const HOOKS_REPO = resolve(import.meta.dirname, "..", "..");

/**
 * Runs a package's command-line tool with this Node, without a shell. Going
 * straight to the tool's JavaScript entry avoids cmd.exe on Windows, whose
 * 8191-character line limit long file lists would overflow.
 *
 * @param {string} pkg The package name, such as "@commitlint/cli".
 * @param {string} bin The command it provides, such as "commitlint".
 * @param {string[]} args
 * @returns {number} the exit code
 */
export function runBin(pkg, bin, args) {
  const manifestPath = resolve(HOOKS_REPO, "node_modules", pkg, "package.json");
  /** @type {{ bin?: string | Record<string, string> }} */
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    console.error(
      `${pkg} is not installed. Run pnpm install at the repository root, then try again.`,
    );
    return 1;
  }
  const entry =
    typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.[bin];
  if (entry === undefined) {
    console.error(`${pkg} has no "${bin}" command.`);
    return 1;
  }
  const script = resolve(dirname(manifestPath), entry);
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

/**
 * Runs each step in order and stops at the first failure.
 *
 * @param {{ name: string, run: () => number }[]} steps
 * @returns {number} the exit code
 */
export function runSteps(steps) {
  for (const step of steps) {
    const code = step.run();
    if (code !== 0) {
      console.error(`\nThe ${step.name} step failed, so Git stopped here.`);
      return code;
    }
  }
  return 0;
}
