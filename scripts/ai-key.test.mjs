import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  Answers,
  configureAiKey,
  HiddenInputUnavailable,
  PROVIDERS,
  setVariable,
} from "./ai-key.mjs";

// Text that looks like nothing real, so no scanner takes it for a key.
const FAKE_KEY = "not-a-real-key-for-tests-7f3a";
const REAL_EXAMPLE = join(import.meta.dirname, "..", ".env.example");

const EXAMPLE = [
  "# Settings",
  "APP_ENV=local",
  "# Which provider.",
  "AI_PROVIDER=mock",
  "# GEMINI_API_KEY=",
  "# GROQ_API_KEY=",
  "# AI_MODEL=",
  "# AI_TIMEOUT_MS=60000",
  "LAST=1",
  "",
].join("\n");

/** @type {string} */
let root;
/** @type {string[]} */
let lines;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "op-ai-key-"));
  lines = [];
  writeFileSync(join(root, ".env.example"), EXAMPLE);
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/**
 * @param {string[]} answers provider, key, model, in the order they are asked
 * @param {NodeJS.ProcessEnv} [env]
 */
function run(answers, env = {}) {
  const [provider = "", key = "", model = ""] = answers;
  /** @type {string[]} */
  const asked = [];
  return configureAiKey({
    root,
    env,
    log: (line) => lines.push(line),
    ask: (question) => {
      asked.push(question);
      return Promise.resolve(asked.length === 1 ? provider : model);
    },
    askSecret: (question) => {
      asked.push(question);
      return Promise.resolve(key);
    },
  });
}

const envPath = () => join(root, ".env");
const output = () => lines.join("\n");

describe("setVariable", () => {
  it("replaces an active line where it stands and keeps every other line", () => {
    const out = setVariable("A=1\nAI_MODEL=old\nB=2\n", "AI_MODEL", "new");
    assert.equal(out, "A=1\nAI_MODEL=new\nB=2\n");
  });

  it("puts a new value under the commented, empty example of its name", () => {
    const out = setVariable(EXAMPLE, "AI_MODEL", "gemini-test");
    assert.equal(
      out,
      EXAMPLE.replace("# AI_MODEL=\n", "# AI_MODEL=\nAI_MODEL=gemini-test\n"),
    );
  });

  it("adds a line at the end when the file knows nothing of the name", () => {
    assert.equal(setVariable("A=1\n", "AI_MODEL", "m"), "A=1\nAI_MODEL=m\n");
    assert.equal(setVariable("", "AI_MODEL", "m"), "AI_MODEL=m\n");
  });

  it("does not touch a commented example that has a value", () => {
    const text = "# AI_MODEL=kept-as-a-comment\n";
    assert.equal(
      setVariable(text, "AI_MODEL", "m"),
      "# AI_MODEL=kept-as-a-comment\nAI_MODEL=m\n",
    );
  });

  it("leaves one line for a name that was set twice", () => {
    const out = setVariable("AI_MODEL=a\nX=1\nAI_MODEL=b\n", "AI_MODEL", "c");
    assert.equal(out, "AI_MODEL=c\nX=1\n");
  });

  it("does not mistake a longer name for the one it is setting", () => {
    const out = setVariable("AI_MODEL_X=1\n", "AI_MODEL", "m");
    assert.equal(out, "AI_MODEL_X=1\nAI_MODEL=m\n");
  });

  it("keeps a file's Windows line endings", () => {
    const out = setVariable("A=1\r\nAI_MODEL=old\r\n", "AI_MODEL", "new");
    assert.equal(out, "A=1\r\nAI_MODEL=new\r\n");
  });
});

describe("configureAiKey", () => {
  it("writes the provider, the key and the model, and keeps every other line", async () => {
    writeFileSync(envPath(), "MY_OWN=keep\nAI_PROVIDER=mock\nZ=9\n");
    const code = await run(["gemini", FAKE_KEY, "gemini-test-model"]);
    assert.equal(code, 0);
    assert.equal(
      readFileSync(envPath(), "utf8"),
      [
        "MY_OWN=keep",
        "AI_PROVIDER=gemini",
        "Z=9",
        `GEMINI_API_KEY=${FAKE_KEY}`,
        "AI_MODEL=gemini-test-model",
        "",
      ].join("\n"),
    );
  });

  it("defaults to gemini and accepts groq and the key variable that goes with it", async () => {
    await run(["", FAKE_KEY, "m1"]);
    assert.match(readFileSync(envPath(), "utf8"), /^AI_PROVIDER=gemini$/m);
    assert.match(readFileSync(envPath(), "utf8"), /^GEMINI_API_KEY=/m);

    lines = [];
    await run([" GROQ ", FAKE_KEY, "qwen/qwen3.8-27b"]);
    const text = readFileSync(envPath(), "utf8");
    assert.match(text, /^AI_PROVIDER=groq$/m);
    assert.ok(text.split("\n").includes(`GROQ_API_KEY=${FAKE_KEY}`));
    assert.match(text, /^AI_MODEL=qwen\/qwen3.8-27b$/m);
    assert.equal(PROVIDERS.groq?.keyVariable, "GROQ_API_KEY");
  });

  it("creates .env from .env.example when it is missing, and keeps the example's lines", async () => {
    assert.equal(existsSync(envPath()), false);
    assert.equal(await run(["gemini", FAKE_KEY, "m"]), 0);
    const text = readFileSync(envPath(), "utf8");
    assert.match(output(), /Created /);
    for (const line of EXAMPLE.split("\n")) {
      if (line === "AI_PROVIDER=mock") continue;
      assert.ok(text.split("\n").includes(line), `kept: ${line}`);
    }
    assert.equal(
      readFileSync(join(root, ".env.example"), "utf8"),
      EXAMPLE,
      "the example is never changed",
    );
  });

  it("works on the real .env.example and changes only the three variables", async () => {
    writeFileSync(
      join(root, ".env.example"),
      readFileSync(REAL_EXAMPLE, "utf8"),
    );
    assert.equal(await run(["gemini", FAKE_KEY, "m"]), 0);
    const before = readFileSync(REAL_EXAMPLE, "utf8").split("\n");
    const after = readFileSync(envPath(), "utf8").split("\n");
    const added = after.filter((line) => !before.includes(line));
    assert.deepEqual(added.sort(), [
      "AI_MODEL=m",
      "AI_PROVIDER=gemini",
      `GEMINI_API_KEY=${FAKE_KEY}`,
    ]);
    const removed = before.filter((line) => !after.includes(line));
    assert.deepEqual(removed, ["AI_PROVIDER=mock"]);
  });

  it("never prints the key, nor any part of it", async () => {
    await run(["gemini", FAKE_KEY, "m"]);
    const text = output();
    assert.ok(!text.includes(FAKE_KEY));
    for (let start = 0; start + 6 <= FAKE_KEY.length; start += 1) {
      assert.ok(!text.includes(FAKE_KEY.slice(start, start + 6)));
    }
  });

  it("says which file it changed, to restart the API, and how to check with the probe", async () => {
    await run(["gemini", FAKE_KEY, "m"]);
    assert.ok(output().includes(envPath()));
    assert.match(output(), /Restart the API/);
    assert.match(output(), /POST \/api\/v1\/ai\/probe/);
    assert.match(output(), /ai\.http/);
  });

  it("names a variable the shell already sets, never its value", async () => {
    await run(["gemini", FAKE_KEY, "m"], { GEMINI_API_KEY: "from-the-shell" });
    assert.match(output(), /GEMINI_API_KEY is already set in this terminal/);
    assert.ok(!output().includes("from-the-shell"));
  });

  it("changes nothing for an empty key, and does not create .env", async () => {
    assert.equal(await run(["gemini", "   ", "m"]), 1);
    assert.equal(existsSync(envPath()), false);
    assert.match(output(), /No key was entered\. Nothing was changed/);

    writeFileSync(envPath(), "KEEP=1\n");
    assert.equal(await run(["gemini", "", "m"]), 1);
    assert.equal(readFileSync(envPath(), "utf8"), "KEEP=1\n");
  });

  it("changes nothing for a key that is not one, and never repeats it", async () => {
    writeFileSync(envPath(), "KEEP=1\n");
    for (const bad of [
      "abc123",
      "has a space in it",
      'quote"in-it-here',
      "a$b-and-more-here",
    ]) {
      lines = [];
      assert.equal(await run(["gemini", bad, "m"]), 1);
      assert.ok(!output().includes(bad));
    }
    assert.equal(readFileSync(envPath(), "utf8"), "KEEP=1\n");
  });

  it("changes nothing for an unknown provider, an empty model or a bad one", async () => {
    writeFileSync(envPath(), "KEEP=1\n");
    assert.equal(await run(["openrouter", FAKE_KEY, "m"]), 1);
    assert.equal(await run(["constructor", FAKE_KEY, "m"]), 1);
    assert.equal(await run(["gemini", FAKE_KEY, ""]), 1);
    assert.equal(await run(["gemini", FAKE_KEY, "two words"]), 1);
    assert.equal(readFileSync(envPath(), "utf8"), "KEEP=1\n");
  });

  it("changes nothing when the person cancels", async () => {
    writeFileSync(envPath(), "KEEP=1\n");
    const code = await configureAiKey({
      root,
      log: (line) => lines.push(line),
      ask: () => Promise.resolve("gemini"),
      askSecret: () => Promise.reject(new Error("cancelled")),
    });
    assert.equal(code, 1);
    assert.equal(readFileSync(envPath(), "utf8"), "KEEP=1\n");
    assert.match(output(), /Cancelled/);
  });

  it("stops when there is neither .env nor .env.example", async () => {
    rmSync(join(root, ".env.example"));
    assert.equal(await run(["gemini", FAKE_KEY, "m"]), 1);
    assert.equal(existsSync(envPath()), false);
  });

  it("says when apps/api/.env would win", async () => {
    mkdirSync(join(root, "apps", "api"), { recursive: true });
    writeFileSync(join(root, "apps", "api", ".env"), "X=1\n");
    await run(["gemini", FAKE_KEY, "m"]);
    assert.match(output(), /apps\/api\/\.env exists/);
  });
});

describe("Answers", () => {
  /** A fake terminal: a stream that can say it is a TTY and records raw mode. */
  function terminal(isTTY = false) {
    const input = Object.assign(new PassThrough(), {
      isTTY,
      /** @type {boolean[]} */
      raw: [],
      setRawMode(/** @type {boolean} */ mode) {
        this.raw.push(mode);
        return this;
      },
    });
    /** @type {string[]} */
    const written = [];
    return {
      input,
      written,
      output: { write: (/** @type {string} */ t) => written.push(t) },
    };
  }

  it("never writes back what a secret answer holds", async () => {
    const { input, output, written } = terminal();
    const answers = new Answers(input, output);
    const pending = answers.ask("Key: ", { secret: true });
    input.write(`${FAKE_KEY}\n`);
    assert.equal(await pending, FAKE_KEY);
    assert.equal(written.join(""), "Key: ");
  });

  it("turns raw mode on for a secret in a terminal and off again, and moves to a new line", async () => {
    const { input, output, written } = terminal(true);
    const answers = new Answers(input, output);
    const pending = answers.ask("Key: ", { secret: true });
    input.write(`${FAKE_KEY}\r`);
    assert.equal(await pending, FAKE_KEY);
    assert.deepEqual(input.raw, [true, false]);
    assert.equal(written.join(""), "Key: \n");
  });

  it("does not use raw mode for a plain question", async () => {
    const { input, output } = terminal(true);
    const answers = new Answers(input, output);
    const pending = answers.ask("Provider? ");
    input.write("groq\n");
    assert.equal(await pending, "groq");
    assert.deepEqual(input.raw, []);
  });

  it("refuses a secret when the input is not a terminal but the screen is, and shows nothing", async () => {
    // Git Bash without winpty: a person at the screen, a pipe for input, and the
    // terminal itself would echo the key.
    const { input, written } = terminal(false);
    const screen = {
      write: (/** @type {string} */ t) => written.push(t),
      isTTY: true,
    };
    const answers = new Answers(input, screen);
    input.write(`${FAKE_KEY}\n`);
    await assert.rejects(
      answers.ask("Key: ", { secret: true }),
      HiddenInputUnavailable,
    );
    assert.deepEqual(written, []);
    assert.deepEqual(input.raw, []);
  });

  it("still reads a plain question, and a secret from a real terminal, on a screen", async () => {
    const piped = terminal(false);
    const pipedScreen = {
      write: (/** @type {string} */ t) => piped.written.push(t),
      isTTY: true,
    };
    const plain = new Answers(piped.input, pipedScreen).ask("Provider? ");
    piped.input.write("groq\n");
    assert.equal(await plain, "groq");

    const real = terminal(true);
    const realScreen = {
      write: (/** @type {string} */ t) => real.written.push(t),
      isTTY: true,
    };
    const secret = new Answers(real.input, realScreen).ask("Key: ", {
      secret: true,
    });
    real.input.write(`${FAKE_KEY}\r`);
    assert.equal(await secret, FAKE_KEY);
  });

  it("applies backspace and drops control characters", async () => {
    const { input, output } = terminal(true);
    const answers = new Answers(input, output);
    const pending = answers.ask("Key: ", { secret: true });
    input.write("abcx\u007f\u0001d\n");
    assert.equal(await pending, "abcd");
  });

  it("keeps what was typed ahead for the next question, and reads Windows line ends once", async () => {
    const { input, output } = terminal();
    const answers = new Answers(input, output);
    const first = answers.ask("One: ");
    input.write("gemini\r\nsecret-value\r\nmodel-id\r\n");
    assert.equal(await first, "gemini");
    assert.equal(await answers.ask("Two: ", { secret: true }), "secret-value");
    assert.equal(await answers.ask("Three: "), "model-id");
  });

  it("answers with what it has when the input ends, and rejects a Ctrl+C", async () => {
    const first = terminal();
    const answers = new Answers(first.input, first.output);
    const pending = answers.ask("Q: ");
    first.input.write("partial");
    first.input.end();
    assert.equal(await pending, "partial");
    assert.equal(await answers.ask("Again: "), "");

    const second = terminal(true);
    const cancelled = new Answers(second.input, second.output).ask("Key: ", {
      secret: true,
    });
    second.input.write("abc\u0003");
    await assert.rejects(cancelled, /cancelled/);
    assert.deepEqual(second.input.raw, [true, false]);
  });
});

describe("the command in a terminal that cannot hide the key", () => {
  it("says to use PowerShell, Windows Terminal or the VS Code terminal, and changes nothing", async () => {
    const input = Object.assign(new PassThrough(), { isTTY: false });
    /** @type {string[]} */
    const written = [];
    const answers = new Answers(input, {
      write: (text) => written.push(text),
      isTTY: true,
    });
    input.write(`gemini\n${FAKE_KEY}\nsome-model\n`);
    const code = await configureAiKey({
      root,
      env: {},
      log: (line) => lines.push(line),
      ask: (question) => answers.ask(question),
      askSecret: (question) => answers.ask(question, { secret: true }),
    });
    assert.equal(code, 1);
    assert.equal(existsSync(envPath()), false);
    const said = lines.join("\n");
    assert.match(said, /PowerShell, Windows Terminal or the VS Code terminal/);
    assert.match(said, /Nothing was changed/);
    assert.ok(!said.includes(FAKE_KEY));
    assert.ok(!written.join("").includes(FAKE_KEY));
  });
});

describe("the command", () => {
  it("run as a program, reads its answers from the input, writes the .env beside it and exits", () => {
    // A copy of the script in a throwaway repository root, so the real .env is
    // never in reach. The answers come in on the input, none on the command line.
    mkdirSync(join(root, "scripts"));
    copyFileSync(
      join(import.meta.dirname, "ai-key.mjs"),
      join(root, "scripts", "ai-key.mjs"),
    );
    const result = spawnSync(
      process.execPath,
      [join(root, "scripts", "ai-key.mjs")],
      {
        input: `gemini\n${FAKE_KEY}\ngemini-test-model\n`,
        encoding: "utf8",
        timeout: 20_000,
      },
    );
    assert.equal(result.status, 0);
    assert.ok(readFileSync(envPath(), "utf8").includes(`=${FAKE_KEY}\n`));
    assert.ok(!result.stdout.includes(FAKE_KEY));
    assert.ok(!result.stderr.includes(FAKE_KEY));
    assert.match(result.stdout, /Restart the API/);
  });
});
