// Points Git at the hooks in .githooks/. `pnpm install` runs this through the
// root `prepare` script, so every clone gets the hooks without a second step.
//
// It does nothing in CI, where nobody commits, nor outside a Git work tree,
// such as a Docker build that copies the sources without .git.

import { git } from "./lib/git.mjs";

export const HOOKS_PATH = ".githooks";

/**
 * Why the hooks should not be installed here, or undefined to go ahead.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {() => boolean} insideWorkTree
 * @returns {string | undefined}
 */
export function reasonToSkip(env, insideWorkTree) {
  if (env["CI"] !== undefined && env["CI"] !== "" && env["CI"] !== "false") {
    return "CI is set";
  }
  if (!insideWorkTree()) return "this is not a Git work tree";
  return undefined;
}

function insideWorkTree() {
  try {
    return git(["rev-parse", "--is-inside-work-tree"]).trim() === "true";
  } catch {
    return false;
  }
}

export function main() {
  const skip = reasonToSkip(process.env, insideWorkTree);
  if (skip !== undefined) {
    console.log(`Git hooks not installed: ${skip}.`);
    return 0;
  }
  git(["config", "--local", "core.hooksPath", HOOKS_PATH]);
  console.log(`Git hooks installed: core.hooksPath is ${HOOKS_PATH}.`);
  return 0;
}

if (import.meta.main) {
  process.exitCode = main();
}
