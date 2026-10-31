import { spawnSync } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";

export const DEFAULT_REPO = "xiu2809xiu-rgb/orderpilot";

const MAX_ATTEMPTS = 5;
const RATE_LIMITED = /secondary rate limit|rate limit exceeded|abuse|HTTP 429/i;
// A 5xx, a dropped connection, or gh choking on an empty reply
// ("unexpected end of JSON input"). A 4xx is a real refusal and never matches.
const FLAKY =
  /HTTP 5\d\d|was submitted too quickly|unexpected end of JSON input|unexpected EOF|connection reset|timed? ?out|ECONNRESET|ETIMEDOUT/i;

// Past this GitHub starts refusing content-creating requests, and a seed makes
// a few hundred of them in a row.
const WRITE_PACE_MS = 1100;

export function runGh(args, input) {
  const result = spawnSync("gh", args, {
    input,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

function isJson(text) {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

const isMutation = (document) => /^\s*mutation\b/.test(document);

// Every call to GitHub goes through this class, so the dry-run promise is kept
// in one place: with dryRun set, write() and mutate() print and return null, and
// only GET requests and GraphQL queries ever reach `gh`.
//
// JSON bodies travel on stdin, never as arguments. `gh --label` splits on
// commas and quoting differs between shells; GitHub refuses a comma in a label
// name anyway, but titles and bodies may hold one.
export class GitHub {
  constructor({
    repo = process.env.GITHUB_REPOSITORY ?? DEFAULT_REPO,
    dryRun = false,
    exec = runGh,
    sleep = wait,
    log = console.log,
    paceMs = WRITE_PACE_MS,
  } = {}) {
    this.repo = repo;
    [this.owner, this.name] = repo.split("/");
    this.dryRun = dryRun;
    this.exec = exec;
    this.sleep = sleep;
    this.log = log;
    this.paceMs = paceMs;
  }

  // With expectJson, a clean exit with an empty or non-JSON body counts as a
  // transient failure too, because the caller is about to parse it.
  async #call(args, input, { expectJson = false } = {}) {
    for (let attempt = 1; ; attempt += 1) {
      const { status, stdout, stderr } = this.exec(args, input);
      if (status === 0 && !(expectJson && !isJson(stdout))) return stdout;
      if (status === 0) {
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(
            `gh ${args.join(" ")} failed: empty or non-JSON reply`,
          );
        }
        await this.sleep(5_000 * attempt);
        continue;
      }
      const message = `${stderr ?? ""}${stdout ?? ""}`;
      const limited = RATE_LIMITED.test(message);
      if (attempt === MAX_ATTEMPTS || (!limited && !FLAKY.test(message))) {
        throw new Error(`gh ${args.join(" ")} failed: ${message.trim()}`);
      }
      await this.sleep(limited ? 60_000 * attempt : 5_000 * attempt);
    }
  }

  async get(path) {
    return JSON.parse(
      await this.#call(["api", path], undefined, { expectJson: true }),
    );
  }

  async getAll(path) {
    const separator = path.includes("?") ? "&" : "?";
    const url = `${path}${separator}per_page=100`;
    const args = ["api", "--paginate", "--slurp", url];
    return JSON.parse(
      await this.#call(args, undefined, { expectJson: true }),
    ).flat();
  }

  async #graphql(document, variables) {
    const body = JSON.stringify({ query: document, variables });
    const stdout = await this.#call(["api", "graphql", "--input", "-"], body, {
      expectJson: true,
    });
    const reply = JSON.parse(stdout);
    if (reply.errors?.length) {
      throw new Error(`GraphQL: ${JSON.stringify(reply.errors)}`);
    }
    return reply.data;
  }

  async query(document, variables = {}) {
    if (isMutation(document)) {
      throw new Error("query() only reads. Send a mutation through mutate().");
    }
    return this.#graphql(document, variables);
  }

  async write(summary, method, path, body) {
    if (this.dryRun) {
      this.log(`would ${summary}`);
      return null;
    }
    this.log(summary);
    const args = ["api", "--method", method, path];
    const input = body === undefined ? undefined : JSON.stringify(body);
    if (input !== undefined) args.push("--input", "-");
    const stdout = await this.#call(args, input);
    await this.sleep(this.paceMs);
    return stdout.trim() ? JSON.parse(stdout) : null;
  }

  async mutate(summary, document, variables = {}) {
    if (this.dryRun) {
      this.log(`would ${summary}`);
      return null;
    }
    this.log(summary);
    const data = await this.#graphql(document, variables);
    await this.sleep(this.paceMs);
    return data;
  }
}
