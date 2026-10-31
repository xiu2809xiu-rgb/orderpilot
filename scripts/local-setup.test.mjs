import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { buildSteps, ensureEnvFile, runSteps } from "./local-setup.mjs";

/** @type {string} */
let root;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "op-local-setup-"));
  writeFileSync(join(root, ".env.example"), "EXAMPLE=1\n");
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("ensureEnvFile", () => {
  it("copies .env.example when .env is missing", () => {
    assert.equal(ensureEnvFile(root), "created");
    assert.equal(readFileSync(join(root, ".env"), "utf8"), "EXAMPLE=1\n");
  });

  it("leaves an existing .env exactly as it is, even when it is old", () => {
    const file = join(root, ".env");
    writeFileSync(file, "MY_OWN=keep\n");
    const past = new Date("2020-01-01T00:00:00Z");
    utimesSync(file, past, past);
    assert.equal(ensureEnvFile(root), "kept");
    assert.equal(readFileSync(file, "utf8"), "MY_OWN=keep\n");
  });
});

describe("runSteps", () => {
  it("stops at the first failure and names the step and what to do", async () => {
    /** @type {string[]} */
    const ran = [];
    /** @type {string[]} */
    const lines = [];
    const code = await runSteps(
      [
        {
          name: "one",
          run: () => (ran.push("one"), { ok: true }),
          hint: "h1",
        },
        {
          name: "two",
          run: () => (ran.push("two"), { ok: false }),
          hint: "do the thing",
        },
        {
          name: "three",
          run: () => (ran.push("three"), { ok: true }),
          hint: "h3",
        },
      ],
      (line) => lines.push(line),
    );
    assert.equal(code, 1);
    assert.deepEqual(ran, ["one", "two"]);
    const text = lines.join("\n");
    assert.match(text, /Stopped at step 2: two failed\./);
    assert.match(text, /What to do: do the thing/);
  });

  it("reports a step that throws as a failure", async () => {
    /** @type {string[]} */
    const lines = [];
    const code = await runSteps(
      [
        {
          name: "boom",
          run: () => {
            throw new Error("disk full");
          },
          hint: "free space",
        },
      ],
      (line) => lines.push(line),
    );
    assert.equal(code, 1);
    assert.match(lines.join("\n"), /disk full/);
  });
});

describe("buildSteps", () => {
  it("runs the setup in order, with the stack started without recreating it", () => {
    /** @type {string[]} */
    const commands = [];
    const steps = buildSteps({
      root,
      exec: (commandLine) => {
        commands.push(commandLine);
        return { ok: true };
      },
    });
    for (const step of steps) step.run();
    assert.deepEqual(commands, [
      "docker info",
      "docker compose up -d --wait --no-recreate",
      "pnpm db:generate",
      "pnpm db:migrate",
      "pnpm --filter @orderpilot/shared --filter @orderpilot/synthetic-data build",
      "pnpm db:seed",
    ]);
  });

  it("says clearly that Docker is not running, and goes no further", async () => {
    /** @type {string[]} */
    const commands = [];
    /** @type {string[]} */
    const lines = [];
    /** @type {string[]} */
    const errors = [];
    const original = console.error;
    console.error = (line) => errors.push(line);
    try {
      const code = await runSteps(
        buildSteps({
          root,
          exec: (commandLine) => {
            commands.push(commandLine);
            return { ok: commandLine !== "docker info" };
          },
        }),
        (line) => lines.push(line),
      );
      assert.equal(code, 1);
    } finally {
      console.error = original;
    }
    assert.deepEqual(commands, ["docker info"]);
    assert.deepEqual(errors, ["Docker is not running."]);
    assert.match(lines.join("\n"), /start it.*run pnpm local:setup again/s);
  });
});
