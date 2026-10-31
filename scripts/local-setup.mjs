// `pnpm local:setup`: brings a clone (or a pull) to the point where the API and
// the web app can run. Safe to run again after every pull.
//
// It never reads an existing .env, because that file may hold a key. It only
// checks that the file exists, copies .env.example when it does not, and may
// print the file's name. Each step stops the run at the first failure and says
// which step failed and what to do.
//
// Not named `pnpm setup`: that is pnpm's own command.

import { spawnSync } from "node:child_process";
import { constants, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

/**
 * @typedef {{ ok: boolean, spawnFailed?: boolean }} CommandResult
 * @typedef {{
 *   name: string,
 *   run: () => CommandResult | Promise<CommandResult>,
 *   hint: string,
 * }} Step
 */

/**
 * Works out how to start a fixed command line without a shell. Under pnpm,
 * npm_execpath says which pnpm is running, and it comes in three forms: a
 * JavaScript file (run through Node), a native executable such as pnpm.exe (run
 * directly), or a .cmd wrapper, which Node cannot start without a shell. Run by
 * hand with plain node, Windows has only the wrapper. Those last two go through
 * cmd.exe with separate arguments. Every command line here is fixed text.
 *
 * @param {string} commandLine
 * @param {NodeJS.ProcessEnv} [env]
 * @param {string} [platform]
 * @returns {{ file: string, args: string[] }}
 */
export function resolveCommand(
  commandLine,
  env = process.env,
  platform = process.platform,
) {
  const [program = "", ...args] = commandLine.split(" ");
  if (program === "pnpm") {
    const script = env.npm_execpath;
    if (script && /pnpm/i.test(script) && !/\.(cmd|bat)$/i.test(script)) {
      return /\.[cm]?js$/i.test(script)
        ? { file: process.execPath, args: [script, ...args] }
        : { file: script, args };
    }
    if (platform === "win32") {
      return { file: "cmd.exe", args: ["/d", "/c", "pnpm", ...args] };
    }
  }
  return { file: program, args };
}

/**
 * Runs a command line in the repository root, with its output shown.
 *
 * @param {string} commandLine
 * @param {boolean} [quiet]
 * @returns {CommandResult}
 */
export function runCommandLine(commandLine, quiet = false) {
  const { file, args } = resolveCommand(commandLine);
  const result = spawnSync(file, args, {
    cwd: REPO_ROOT,
    stdio: quiet ? "ignore" : "inherit",
  });
  return {
    ok: result.status === 0,
    spawnFailed: result.error !== undefined,
  };
}

/**
 * Creates .env from .env.example when it is missing. COPYFILE_EXCL makes the
 * copy fail rather than overwrite, so a file made between the check and the
 * copy is still safe. Returns what happened, never the file's contents.
 *
 * @param {string} root
 * @returns {"created" | "kept"}
 */
export function ensureEnvFile(root = REPO_ROOT) {
  const target = join(root, ".env");
  if (existsSync(target)) return "kept";
  copyFileSync(join(root, ".env.example"), target, constants.COPYFILE_EXCL);
  return "created";
}

/**
 * @param {{
 *   root?: string,
 *   exec?: (commandLine: string, quiet?: boolean) => CommandResult,
 * }} [options]
 * @returns {Step[]}
 */
export function buildSteps(options = {}) {
  const root = options.root ?? REPO_ROOT;
  const exec = options.exec ?? runCommandLine;
  /** @param {string} commandLine */
  const command = (commandLine) => () => exec(commandLine);

  return [
    {
      name: "Settings file (.env)",
      run: () => {
        const outcome = ensureEnvFile(root);
        console.log(
          outcome === "created"
            ? "Created .env from .env.example."
            : "Found .env. It is left as it is.",
        );
        return { ok: true };
      },
      hint: "Copy .env.example to .env by hand, then run pnpm local:setup again.",
    },
    {
      name: "Check that Docker is running",
      run: () => {
        const result = exec("docker info", true);
        if (!result.ok) {
          console.error(
            result.spawnFailed
              ? "Docker could not be started from this terminal."
              : "Docker is not running.",
          );
        }
        return result;
      },
      hint: "Install Docker Desktop if you have not, start it, wait until it says it is running, then run pnpm local:setup again.",
    },
    {
      name: "Start PostgreSQL, Redis, MinIO and Mailpit",
      run: command("docker compose up -d --wait --no-recreate"),
      hint: "Read the message above. A port already in use is the usual cause: change the port in .env (see Getting started), then run pnpm local:setup again. The first start compiles MinIO and takes a few minutes.",
    },
    {
      name: "Generate the Prisma client",
      run: command("pnpm db:generate"),
      hint: "Run pnpm install, then pnpm local:setup again.",
    },
    {
      name: "Apply the database migrations",
      run: command("pnpm db:migrate"),
      hint: "Check that the stack is healthy (docker compose ps) and that DATABASE_URL in .env points at it.",
    },
    {
      name: "Build the shared packages",
      run: command(
        "pnpm --filter @orderpilot/shared --filter @orderpilot/synthetic-data build",
      ),
      hint: "Fix the compiler error above, or run pnpm install and try again.",
    },
    {
      name: "Seed the database",
      run: command("pnpm db:seed"),
      hint: "Read the message above, then run pnpm local:setup again. The seed is safe to run twice.",
    },
  ];
}

/**
 * Runs the steps in order and stops at the first that fails.
 *
 * @param {Step[]} steps
 * @param {(line: string) => void} [log]
 * @returns {Promise<number>} the exit code
 */
export async function runSteps(steps, log = console.log) {
  for (const [index, step] of steps.entries()) {
    log(`\n[${index + 1}/${steps.length}] ${step.name}`);
    let result;
    try {
      result = await step.run();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      log(`${reason}`);
      result = { ok: false };
    }
    if (!result.ok) {
      log("");
      log(`Stopped at step ${index + 1} of ${steps.length}: ${step.name}.`);
      log("That step failed.");
      log(`What to do: ${step.hint}`);
      return 1;
    }
  }
  log(
    "\nDone. Start the API and the web app with: pnpm dev\nThen open the web app (WEB_PORT in .env, 5173 by default) and sign in with a role button.",
  );
  return 0;
}

if (import.meta.main) {
  process.exitCode = await runSteps(buildSteps());
}
