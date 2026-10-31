import assert from "node:assert/strict";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { refusalFor } from "./check-samples.mjs";
import { TempRepo } from "./lib/temp-repo.mjs";

const SCRIPT = join(import.meta.dirname, "check-samples.mjs");

describe("refusalFor", () => {
  it("allows only the README in the root samples folder", () => {
    assert.equal(refusalFor("samples/README.md"), undefined);
    assert.ok(refusalFor("samples/po-001.pdf"));
    assert.ok(refusalFor("samples/notes.md"));
    assert.ok(refusalFor("samples/nested/README.md"));
  });

  it("refuses client document types in any folder called samples", () => {
    for (const path of [
      "apps/api/samples/po.pdf",
      "docs/Samples/invoice.XLSX",
      "packages/x/test/samples/scan.jpeg",
      "a/b/c/samples/d/export.csv",
    ]) {
      assert.ok(refusalFor(path), path);
    }
  });

  it("allows code and docs elsewhere, and code inside other samples folders", () => {
    for (const path of [
      "README.md",
      "docs/data-formats.md",
      "packages/synthetic-documents/out/po.pdf",
      "apps/web/src/samples/sample-list.tsx",
      "samples-guide.pdf",
      "docs/samples.md",
    ]) {
      assert.equal(refusalFor(path), undefined, path);
    }
  });
});

describe("check-samples", () => {
  /** @type {TempRepo} */
  let repo;
  beforeEach(() => {
    repo = new TempRepo();
    repo.commit({
      "README.md": "# Test\n",
      "samples/README.md": "# Samples\n",
    });
  });
  afterEach(() => {
    repo.remove();
  });

  /** @param {string[]} args */
  const check = (args) => repo.run(process.execPath, [SCRIPT, ...args]);

  it("passes a clean tree", () => {
    assert.equal(check([]).status, 0);
    assert.equal(check(["--history"]).status, 0);
  });

  it("refuses a sample forced past .gitignore into the index", () => {
    repo.stage({ "samples/po-001.pdf": "%PDF-1.7" });
    const result = check(["--staged"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /samples\/po-001\.pdf/);
  });

  it("finds a sample in history even after it was deleted", () => {
    repo.commit({ "services/x/samples/invoice.pdf": "%PDF-1.7" });
    repo.git(["rm", "-q", "services/x/samples/invoice.pdf"]);
    repo.git(["commit", "-q", "--no-verify", "-m", "test: remove it"]);
    assert.equal(check([]).status, 0);
    const result = check(["--history"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /services\/x\/samples\/invoice\.pdf in commit/);
  });

  it("checks only the commits in a revision range", () => {
    const base = repo.git(["rev-parse", "HEAD"]).trim();
    repo.commit({ "samples/a.png": "png" });
    assert.equal(check(["--", "HEAD", "--not", base]).status, 1);
    assert.equal(check(["--", base]).status, 0);
  });
});
