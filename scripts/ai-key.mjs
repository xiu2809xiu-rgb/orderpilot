// `pnpm ai:key`: puts a real AI provider's key into the root .env without
// anyone editing the file by hand, and without the key ever passing through a
// chat, a screen or a log.
//
// It asks three things: the provider (gemini or groq), the key, and the model
// id. The key is read with nothing shown on screen. It then sets AI_PROVIDER,
// the provider's key variable and AI_MODEL in the root .env, creating that file
// from .env.example when it is missing, and leaves every other line as it was.
//
// The key is never printed, logged or echoed, not even in part, and no message
// here is built from it. An empty or malformed answer changes nothing.
//
// This script talks to no provider. The check that the key works is the
// gateway's own probe, after the API has been restarted.

import { constants, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(import.meta.dirname, "..");

/**
 * The two providers the gateway presets. Their addresses are known to the
 * gateway, so only the key and the model id are needed.
 *
 * @type {Readonly<Record<string, { keyVariable: string, modelsUrl: string }>>}
 */
export const PROVIDERS = {
  gemini: {
    keyVariable: "GEMINI_API_KEY",
    modelsUrl: "https://ai.google.dev/gemini-api/docs/models",
  },
  groq: {
    keyVariable: "GROQ_API_KEY",
    modelsUrl: "https://console.groq.com/docs/models",
  },
};

export const DEFAULT_PROVIDER = "gemini";

// A key is letters, digits and a few separators. Refusing everything else keeps
// a space, a quote, a # or a $ from changing how the file is read (the API
// expands $ references), and turns a pasted escape sequence into a refusal.
const KEY_PATTERN = /^[A-Za-z0-9._~+/=:-]{8,512}$/;

// Model ids such as gemini-2.5-flash, qwen/qwen3.8-27b or llama3:8b.
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;

/** @param {string} line the name set by an active line, or null for anything else */
function activeName(line) {
  let text = line.trimStart();
  if (text.startsWith("#")) return null;
  if (text.startsWith("export ")) text = text.slice("export ".length);
  const equals = text.indexOf("=");
  return equals < 0 ? null : text.slice(0, equals).trim();
}

/** @param {string} line the name of a commented, empty example such as "# AI_MODEL=" */
function placeholderName(line) {
  const text = line.trim();
  if (!text.startsWith("#")) return null;
  const rest = text.slice(1).trimStart();
  const equals = rest.indexOf("=");
  if (equals < 0 || rest.slice(equals + 1).trim() !== "") return null;
  const name = rest.slice(0, equals).trimEnd();
  return /^[A-Z][A-Z0-9_]*$/.test(name) ? name : null;
}

/**
 * Sets one variable in the text of an env file and returns the new text.
 * An active line is replaced where it stands (a repeat of it is dropped).
 * Otherwise the value goes right under the commented, empty example of the
 * name when there is one, and at the end of the file when there is not. Every
 * other line, comments included, is kept exactly. The file's own line ending
 * is kept.
 *
 * @param {string} text
 * @param {string} name
 * @param {string} value
 * @returns {string}
 */
export function setVariable(text, name, value) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const body = text.endsWith(eol) ? text.slice(0, -eol.length) : text;
  const lines = body === "" ? [] : body.split(eol);
  const line = `${name}=${value}`;

  const active = lines.flatMap((entry, index) =>
    activeName(entry) === name ? [index] : [],
  );
  if (active.length > 0) {
    lines[active[0] ?? 0] = line;
    for (const index of active.slice(1).reverse()) lines.splice(index, 1);
  } else {
    const example = lines.findIndex((entry) => placeholderName(entry) === name);
    if (example >= 0) lines.splice(example + 1, 0, line);
    else lines.push(line);
  }
  return lines.join(eol) + eol;
}

/**
 * Thrown when a key would be typed where this script cannot turn the echo off:
 * a terminal whose input is not a TTY, such as Git Bash without winpty. The
 * terminal itself would then show the key.
 */
export class HiddenInputUnavailable extends Error {
  constructor() {
    super(
      "This terminal cannot hide what you type, so the key would show. Run pnpm ai:key in PowerShell, Windows Terminal or the VS Code terminal.",
    );
    this.name = "HiddenInputUnavailable";
  }
}

/**
 * Reads answers one at a time from a stream. Anything typed ahead of a
 * question stays for the next one, so piped input works too. A secret answer is
 * collected character by character and never written back: in a terminal the
 * raw mode turns the terminal's own echo off, and in a pipe there is none.
 * Where a person is at the screen (the output is a TTY) but the input is not a
 * TTY, the terminal would echo the key and this script cannot stop it, so a
 * secret is refused there.
 */
export class Answers {
  /**
   * @param {NodeJS.ReadableStream & {
   *   isTTY?: boolean,
   *   setRawMode?: (mode: boolean) => unknown,
   * }} input
   * @param {{ write: (text: string) => unknown, isTTY?: boolean }} output
   */
  constructor(input, output) {
    this.input = input;
    this.output = output;
    this.pending = "";
    this.ended = false;
    input.once("end", () => {
      this.ended = true;
    });
  }

  /**
   * @param {string} question
   * @param {{ secret?: boolean }} [options]
   * @returns {Promise<string>}
   */
  ask(question, options = {}) {
    const secret = options.secret === true;
    const { input, output } = this;
    if (secret && input.isTTY !== true && output.isTTY === true) {
      return Promise.reject(new HiddenInputUnavailable());
    }
    output.write(question);
    const raw = secret && input.isTTY === true && !!input.setRawMode;

    return new Promise((resolve, reject) => {
      let answer = "";
      let listening = false;
      /** @param {boolean} cancelled */
      const finish = (cancelled) => {
        if (listening) {
          listening = false;
          input.removeListener("data", onData);
          input.removeListener("end", onEnd);
          if (raw) input.setRawMode?.(false);
          input.pause();
          // The Enter was not echoed in raw mode, so move to the next line.
          if (raw) output.write("\n");
        }
        if (cancelled) reject(new Error("cancelled"));
        else resolve(answer);
      };
      const onEnd = () => finish(false);
      /**
       * Reads text into the answer. Returns "line" when Enter ended it,
       * "cancel" on Ctrl+C, and "more" when the answer is not finished.
       *
       * @param {string} text
       * @returns {"line" | "cancel" | "more"}
       */
      const take = (text) => {
        const chars = [...text.replaceAll("\r\n", "\n")];
        for (const [index, char] of chars.entries()) {
          if (char === "\n" || char === "\r") {
            this.pending = chars.slice(index + 1).join("");
            return "line";
          }
          if (char === "\u0003") return "cancel";
          if (char === "\u007f" || char === "\b") {
            answer = answer.slice(0, -1);
          } else if (char >= " ") {
            answer += char;
          }
        }
        return "more";
      };
      /** @param {Buffer | string} chunk */
      const onData = (chunk) => {
        const state = take(chunk.toString());
        if (state !== "more") finish(state === "cancel");
      };

      const queued = this.pending;
      this.pending = "";
      const state = queued === "" ? "more" : take(queued);
      if (state !== "more" || this.ended) {
        finish(state === "cancel");
        return;
      }
      listening = true;
      if (raw) input.setRawMode?.(true);
      input.on("data", onData);
      input.on("end", onEnd);
      input.resume();
    });
  }
}

/**
 * @param {{
 *   root?: string,
 *   ask: (question: string) => Promise<string>,
 *   askSecret: (question: string) => Promise<string>,
 *   log?: (line: string) => void,
 *   env?: NodeJS.ProcessEnv,
 * }} options
 * @returns {Promise<number>} the exit code
 */
export async function configureAiKey(options) {
  const root = options.root ?? REPO_ROOT;
  const log = options.log ?? console.log;
  const env = options.env ?? process.env;
  const target = join(root, ".env");
  const example = join(root, ".env.example");

  if (!existsSync(target) && !existsSync(example)) {
    log(
      `There is no .env and no .env.example in ${root}. Nothing was changed.`,
    );
    return 1;
  }

  let providerName;
  let key;
  let model;
  try {
    log(
      "This puts an AI provider's key in the root .env. Nothing is sent anywhere.",
    );
    const chosen = (
      await options.ask(
        `Which provider, gemini or groq? [${DEFAULT_PROVIDER}] `,
      )
    )
      .trim()
      .toLowerCase();
    providerName = chosen === "" ? DEFAULT_PROVIDER : chosen;
    const provider = PROVIDERS[providerName];
    if (provider === undefined || !Object.hasOwn(PROVIDERS, providerName)) {
      log("Choose gemini or groq. Nothing was changed.");
      return 1;
    }

    key = (
      await options.askSecret(
        `The ${providerName} key (in a terminal nothing shows as you type or paste): `,
      )
    ).trim();
    if (key === "") {
      log("No key was entered. Nothing was changed.");
      return 1;
    }
    if (!KEY_PATTERN.test(key)) {
      log(
        "That is not a key: it has a space or a character a key does not use, or it is too short. Nothing was changed.",
      );
      return 1;
    }

    log(
      `Models are renamed and retired often, so the id has no default. Current ids: ${provider.modelsUrl}`,
    );
    model = (await options.ask("The model id: ")).trim();
    if (model === "") {
      log("No model id was entered. Nothing was changed.");
      return 1;
    }
    if (!MODEL_PATTERN.test(model)) {
      log(
        "That is not a model id: it has a space or a character an id does not use. Nothing was changed.",
      );
      return 1;
    }
  } catch (error) {
    if (error instanceof HiddenInputUnavailable) {
      log(`${error.message} Nothing was changed.`);
    } else {
      log("Cancelled. Nothing was changed.");
    }
    return 1;
  }

  const keyVariable = PROVIDERS[providerName]?.keyVariable ?? "";
  const created = !existsSync(target);
  let text = readFileSync(created ? example : target, "utf8");
  text = setVariable(text, "AI_PROVIDER", providerName);
  text = setVariable(text, keyVariable, key);
  text = setVariable(text, "AI_MODEL", model);
  // "wx" fails instead of replacing a file made since the check above.
  writeFileSync(target, text, {
    flag: created ? "wx" : "w",
    mode: constants.S_IRUSR | constants.S_IWUSR,
  });

  log("");
  log(
    `${created ? "Created" : "Changed"} ${target}. It now sets AI_PROVIDER=${providerName}, ${keyVariable} and AI_MODEL=${model}. Every other line is as it was.`,
  );
  const names = ["AI_PROVIDER", keyVariable, "AI_MODEL"];
  const shell = names.filter((name) => env[name] !== undefined);
  if (shell.length > 0) {
    log(
      `${shell.join(", ")} is already set in this terminal, and the shell wins over the file. Unset it, or open a new terminal.`,
    );
  }
  if (existsSync(join(root, "apps", "api", ".env"))) {
    log(
      "apps/api/.env exists and is read first: a name set there wins over the root .env.",
    );
  }
  log("");
  log("Next:");
  log("1. Restart the API (stop pnpm dev with Ctrl+C and start it again).");
  log(
    "2. Check it with the gateway's own probe: sign in as System admin and send the second request in apps/api/requests/ai.http (POST /api/v1/ai/probe, mode text). The answer says ok, error or timeout and a reason code, and never a key.",
  );
  log(
    "Only synthetic data may be sent to a real provider, and a free tier may keep what it is sent.",
  );
  return 0;
}

if (import.meta.main) {
  const answers = new Answers(process.stdin, process.stdout);
  process.exitCode = await configureAiKey({
    ask: (question) => answers.ask(question),
    askSecret: (question) => answers.ask(question, { secret: true }),
  });
}
