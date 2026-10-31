// Throwaway Git repositories for the tests of the checks and hooks. Each one
// lives in the system temp folder and is removed when the test ends.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * @typedef {{ status: number, stdout: string, stderr: string }} RunResult
 */

/**
 * Runs a command and returns its result, whatever its exit code.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv, input?: string }} options
 * @returns {RunResult}
 */
export function runCommand(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    input: options.input,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  return {
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export class TempRepo {
  /**
   * @param {{ bare?: boolean }} [options]
   */
  constructor(options = {}) {
    /** @type {string} */
    this.root = mkdtempSync(join(tmpdir(), "orderpilot-test-"));
    /** @type {string} */
    this.dir = join(this.root, "repo");
    mkdirSync(this.dir);
    // An empty global config and a fixed identity, with no signing and no
    // personal hooks, so the tests behave the same on every machine and in CI.
    const globalConfig = join(this.root, "gitconfig");
    writeFileSync(globalConfig, "");
    /** @type {NodeJS.ProcessEnv} */
    this.env = {
      GIT_CONFIG_GLOBAL: globalConfig,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "OrderPilot Test",
      GIT_AUTHOR_EMAIL: "test@example.invalid",
      GIT_COMMITTER_NAME: "OrderPilot Test",
      GIT_COMMITTER_EMAIL: "test@example.invalid",
    };
    this.git([
      "init",
      "-q",
      "--initial-branch=main",
      ...(options.bare ? ["--bare"] : []),
    ]);
    if (!options.bare) this.git(["config", "core.autocrlf", "false"]);
  }

  /**
   * Runs a command in this repository and returns the result.
   *
   * @param {string} command
   * @param {string[]} args
   * @param {{ env?: NodeJS.ProcessEnv, input?: string }} [options]
   * @returns {RunResult}
   */
  run(command, args, options = {}) {
    return runCommand(command, args, {
      cwd: this.dir,
      input: options.input,
      env: { ...this.env, ...options.env },
    });
  }

  /**
   * Runs git here and returns the result, whatever its exit code.
   *
   * @param {string[]} args
   * @param {{ env?: NodeJS.ProcessEnv, input?: string }} [options]
   * @returns {RunResult}
   */
  tryGit(args, options = {}) {
    return this.run("git", args, options);
  }

  /**
   * Runs git here and throws if it fails.
   *
   * @param {string[]} args
   * @param {{ env?: NodeJS.ProcessEnv, input?: string }} [options]
   * @returns {string}
   */
  git(args, options = {}) {
    const result = this.tryGit(args, options);
    if (result.status !== 0) {
      throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
    }
    return result.stdout;
  }

  /**
   * @param {string} path
   * @param {string | Buffer} content
   */
  write(path, content) {
    const full = join(this.dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  /**
   * Writes the files and stages them, with -f so .gitignore cannot stop it.
   *
   * @param {Record<string, string | Buffer>} files
   */
  stage(files) {
    for (const [path, content] of Object.entries(files)) {
      this.write(path, content);
    }
    this.git(["add", "-f", "--", ...Object.keys(files)]);
  }

  /**
   * Stages the files and commits them without running any hooks.
   *
   * @param {Record<string, string | Buffer>} files
   * @param {string} [message]
   */
  commit(files, message = "test: add files") {
    this.stage(files);
    this.git(["commit", "--no-verify", "-q", "-m", message]);
  }

  remove() {
    rmSync(this.root, { recursive: true, force: true });
  }
}
