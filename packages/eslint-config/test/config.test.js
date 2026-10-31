// Lints fixtures with known faults and checks that each one is caught, so a
// dependency update that silently drops a rule fails here first.

import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

import { ESLint } from "eslint";

import { orderpilot, warningsAsErrors } from "../index.js";

const fixtures = join(import.meta.dirname, "fixtures");

function makeEslint() {
  return new ESLint({
    cwd: fixtures,
    overrideConfigFile: true,
    overrideConfig: orderpilot({ tsconfigRootDir: fixtures }),
  });
}

/** @param {string} file */
async function lint(file) {
  const [result] = await makeEslint().lintFiles([join(fixtures, file)]);
  assert.ok(result, `no result for ${file}`);
  return result.messages;
}

/**
 * @param {import("eslint").Linter.LintMessage[]} messages
 * @param {string} ruleId
 */
function assertError(messages, ruleId) {
  const hit = messages.find((message) => message.ruleId === ruleId);
  assert.ok(hit, `expected ${ruleId}, got ${JSON.stringify(messages)}`);
  assert.equal(hit.severity, 2, `${ruleId} must be an error`);
}

describe("@orderpilot/eslint-config", () => {
  it("rejects any and floating promises in TypeScript (type-aware)", async () => {
    const messages = await lint("unsafe.ts");
    assertError(messages, "@typescript-eslint/no-explicit-any");
    assertError(messages, "@typescript-eslint/no-floating-promises");
    assertError(messages, "@typescript-eslint/no-unsafe-member-access");
  });

  it("rejects inaccessible JSX with jsx-a11y", async () => {
    const messages = await lint("inaccessible.tsx");
    assertError(messages, "jsx-a11y/alt-text");
    assertError(messages, "jsx-a11y/click-events-have-key-events");
    assertError(messages, "jsx-a11y/no-static-element-interactions");
  });

  it("accepts clean TypeScript and JavaScript", async () => {
    assert.deepEqual(await lint("clean.ts"), []);
    assert.deepEqual(await lint("clean.js"), []);
  });

  it("leaves no rule at warn, for any file type", async () => {
    const eslint = makeEslint();
    for (const file of ["clean.ts", "inaccessible.tsx", "clean.js"]) {
      /** @type {import("eslint").Linter.Config} */
      const config = await eslint.calculateConfigForFile(join(fixtures, file));
      for (const [name, entry] of Object.entries(config.rules ?? {})) {
        const severity = Array.isArray(entry) ? entry[0] : entry;
        assert.ok(
          severity === 0 ||
            severity === 2 ||
            severity === "off" ||
            severity === "error",
          `${name} is ${JSON.stringify(severity)} for ${file}`,
        );
      }
    }
  });

  it("turns warn into error and keeps rule options", () => {
    const config = warningsAsErrors({
      rules: { a: "warn", b: ["warn", { max: 3 }], c: 1, d: "off" },
    });
    assert.deepEqual(config.rules, {
      a: "error",
      b: ["error", { max: 3 }],
      c: "error",
      d: "off",
    });
  });
});
