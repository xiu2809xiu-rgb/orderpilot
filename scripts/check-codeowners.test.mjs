import assert from "node:assert/strict";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { parseRules, unmatchedRules } from "./check-codeowners.mjs";
import { TempRepo } from "./lib/temp-repo.mjs";

const SCRIPT = join(import.meta.dirname, "check-codeowners.mjs");

describe("parseRules", () => {
  it("reads the path and its owners, and skips comments and blank lines", () => {
    const rules = parseRules(
      [
        "# Who owns what.",
        "",
        "*              @richie @angelyn",
        "  /docs/team/area-2-*.md   @azri @iok",
      ].join("\n"),
    );
    assert.deepEqual(rules, [
      { line: 3, pattern: "*", owners: ["@richie", "@angelyn"] },
      { line: 4, pattern: "/docs/team/area-2-*.md", owners: ["@azri", "@iok"] },
    ]);
  });

  it("counts lines the same with Windows line endings", () => {
    const rules = parseRules("# one\r\n\r\n/apps/ @richie\r\n");
    assert.equal(rules[0]?.line, 3);
  });
});

describe("unmatchedRules", () => {
  it("names only the rules that match nothing, with their line", () => {
    const rules = parseRules("/apps/ @a\n/infra/ @a\n/docs/ @a\n");
    const counts = new Map([
      ["/apps/", 12],
      ["/infra/", 0],
      ["/docs/", 3],
    ]);
    assert.deepEqual(
      unmatchedRules(rules, (pattern) => counts.get(pattern) ?? 0),
      ["line 2: /infra/ matches no tracked file"],
    );
  });
});

describe("check-codeowners", () => {
  /** @type {TempRepo} */
  let repo;
  beforeEach(() => {
    repo = new TempRepo();
    repo.commit({
      "README.md": "# Test\n",
      "apps/api/Dockerfile": "FROM scratch\n",
      "apps/api/src/auth/auth.module.ts": "export {};\n",
      "docs/team/area-1-document-ai.md": "# Area 1\n",
    });
  });
  afterEach(() => {
    repo.remove();
  });

  /** @param {string} text */
  const withCodeowners = (text) => {
    repo.commit({ ".github/CODEOWNERS": text }, "chore: owners");
  };
  const check = () => repo.run(process.execPath, [SCRIPT]);

  it("passes when every rule matches a tracked file", () => {
    withCodeowners(
      [
        "* @richie",
        "/apps/api/src/auth/ @richie",
        "/apps/*/Dockerfile @richie @azri",
        "/docs/team/area-1-*.md @richie",
        "/README.md @richie",
      ].join("\n"),
    );
    const result = check();
    assert.equal(result.status, 0, result.stderr);
  });

  it("fails on a folder that moved or does not exist yet, and names its line", () => {
    withCodeowners(
      [
        "* @richie",
        "/apps/api/src/modules/auth/ @richie",
        "/infra/ @richie",
      ].join("\n"),
    );
    const result = check();
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /line 2: \/apps\/api\/src\/modules\/auth\/ matches no tracked file/,
    );
    assert.match(result.stderr, /line 3: \/infra\/ matches no tracked file/);
  });

  it("treats letter case as GitHub does, even where the file system ignores it", () => {
    withCodeowners(["* @richie", "/Docs/ @richie"].join("\n"));
    const result = check();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /line 2: \/Docs\/ matches no tracked file/);
  });
});
