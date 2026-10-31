import assert from "node:assert/strict";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { isEnvFile, parseEnv } from "./check-licence-key.mjs";
import { TempRepo } from "./lib/temp-repo.mjs";

const SCRIPT = join(import.meta.dirname, "check-licence-key.mjs");

// Fake values, made up for this test. They are not keys.
const FAKE_REUI = "fake-reui-value-for-tests-0001";
const FAKE_REACTBITS = "fake-reactbits-value-for-tests-0002";

describe("parseEnv", () => {
  it("reads plain, quoted and exported values and skips comments", () => {
    const env = parseEnv(
      [
        "# a comment",
        "REUI_LICENSE_KEY=abc",
        'REACTBITS_LICENSE_KEY="quoted value"',
        "export OTHER='single'",
        "",
        "not a line",
      ].join("\n"),
    );
    assert.equal(env.get("REUI_LICENSE_KEY"), "abc");
    assert.equal(env.get("REACTBITS_LICENSE_KEY"), "quoted value");
    assert.equal(env.get("OTHER"), "single");
    assert.equal(env.size, 3);
  });
});

describe("isEnvFile", () => {
  it("refuses env files except the example", () => {
    assert.ok(isEnvFile(".env"));
    assert.ok(isEnvFile("apps/web/.env.local"));
    assert.ok(isEnvFile(".env.production"));
    assert.equal(isEnvFile(".env.example"), false);
    assert.equal(isEnvFile("docs/env.md"), false);
  });
});

describe("check-licence-key", () => {
  /** @type {TempRepo} */
  let repo;
  /** @type {NodeJS.ProcessEnv} */
  let env;
  beforeEach(() => {
    repo = new TempRepo();
    repo.commit({ "README.md": "# Test\n" });
    repo.write(
      "keys.env",
      `REUI_LICENSE_KEY=${FAKE_REUI}\nREACTBITS_LICENSE_KEY="${FAKE_REACTBITS}"\n`,
    );
    env = {
      ORDERPILOT_LICENCE_ENV_FILE: join(repo.dir, "keys.env"),
      REUI_LICENSE_KEY: "",
      REACTBITS_LICENSE_KEY: "",
    };
  });
  afterEach(() => {
    repo.remove();
  });

  /** @param {string[]} args */
  const check = (args) =>
    repo.run(process.execPath, [SCRIPT, ...args], { env });

  it("refuses a staged file holding a key, and never prints the value", () => {
    repo.stage({ "components.json": `{ "key": "${FAKE_REUI}" }\n` });
    const result = check(["--staged"]);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /components\.json: contains the value of REUI_LICENSE_KEY/,
    );
    assert.equal(result.stderr.includes(FAKE_REUI), false);
    assert.equal(result.stdout.includes(FAKE_REUI), false);
  });

  it("finds a key given only through the environment", () => {
    env = { REACTBITS_LICENSE_KEY: FAKE_REACTBITS };
    repo.stage({ "src/kit.ts": `const k = "${FAKE_REACTBITS}";\n` });
    const result = check(["--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /REACTBITS_LICENSE_KEY/);
  });

  it("accepts a reference to the key by name", () => {
    repo.stage({ "components.json": '{ "key": "${REUI_LICENSE_KEY}" }\n' });
    assert.equal(check(["--staged"]).status, 0);
  });

  it("refuses an env file forced past .gitignore", () => {
    repo.stage({ "apps/web/.env.local": "SOMETHING=1\n" });
    const result = check(["--staged"]);
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /apps\/web\/\.env\.local: env files are never committed/,
    );
  });

  it("checks tracked files by default", () => {
    assert.equal(check([]).status, 0);
    repo.commit({ "notes.md": `key: ${FAKE_REUI}\n` });
    assert.equal(check([]).status, 1);
  });
});
