import assert from "node:assert/strict";
import { join } from "node:path";
import { describe, it } from "node:test";

import { reasonToSkip } from "./install-hooks.mjs";
import { TempRepo } from "./lib/temp-repo.mjs";

const SCRIPT = join(import.meta.dirname, "install-hooks.mjs");

describe("install-hooks", () => {
  it("skips in CI and outside a work tree, and runs otherwise", () => {
    assert.equal(
      reasonToSkip({ CI: "true" }, () => true),
      "CI is set",
    );
    assert.equal(
      reasonToSkip({}, () => false),
      "this is not a Git work tree",
    );
    assert.equal(
      reasonToSkip({ CI: "false" }, () => true),
      undefined,
    );
    assert.equal(
      reasonToSkip({}, () => true),
      undefined,
    );
  });

  it("points core.hooksPath at .githooks", () => {
    const repo = new TempRepo();
    try {
      const result = repo.run(process.execPath, [SCRIPT], {
        env: { CI: "" },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        repo.git(["config", "--local", "core.hooksPath"]).trim(),
        ".githooks",
      );
    } finally {
      repo.remove();
    }
  });
});
