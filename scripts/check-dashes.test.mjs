import assert from "node:assert/strict";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { EM_DASH, findDashes } from "./check-dashes.mjs";
import { TempRepo } from "./lib/temp-repo.mjs";

const SCRIPT = join(import.meta.dirname, "check-dashes.mjs");

describe("findDashes", () => {
  it("finds every em dash with its line and column", () => {
    const text = `first line\nsecond ${EM_DASH} third ${EM_DASH}\n`;
    assert.deepEqual(findDashes(text), [
      { line: 2, column: 8 },
      { line: 2, column: 16 },
    ]);
  });

  it("allows hyphens and en dashes", () => {
    assert.deepEqual(findDashes("a - b – c"), []);
  });

  it("skips comment lines in a commit message", () => {
    const message = `docs: fix the guide\n# ${EM_DASH} a comment Git strips\n`;
    assert.deepEqual(findDashes(message, { skipComments: true }), []);
    assert.equal(findDashes(message).length, 1);
  });
});

describe("check-dashes", () => {
  /** @type {TempRepo} */
  let repo;
  beforeEach(() => {
    repo = new TempRepo();
  });
  afterEach(() => {
    repo.remove();
  });

  /** @param {string[]} args */
  const check = (args) => repo.run(process.execPath, [SCRIPT, ...args]);

  it("refuses a staged em dash and names the file and place", () => {
    repo.stage({ "docs/guide.md": `# Guide\n\nOne ${EM_DASH} two\n` });
    const result = check(["--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /docs\/guide\.md:3:5: em dash/);
  });

  it("checks the staged content, not the working tree", () => {
    repo.stage({ "a.md": "clean\n" });
    repo.write("a.md", `dirty ${EM_DASH}\n`);
    assert.equal(check(["--staged"]).status, 0);
  });

  it("checks every tracked file by default, and skips binary files", () => {
    repo.commit({
      "clean.md": "fine\n",
      "image.png": Buffer.from([0x89, 0x50, 0, 0, 0xe2, 0x80, 0x94]),
    });
    assert.equal(check([]).status, 0);
    repo.commit({ "notes.txt": `bad ${EM_DASH}\n` });
    const result = check([]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /notes\.txt:1:5/);
  });

  it("checks a commit message file", () => {
    repo.write("MSG", `docs: a ${EM_DASH} b\n`);
    assert.equal(check(["--message=MSG"]).status, 1);
    repo.write("MSG", "docs: a - b\n");
    assert.equal(check(["--message=MSG"]).status, 0);
  });
});
