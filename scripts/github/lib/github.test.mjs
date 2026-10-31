import assert from "node:assert/strict";
import { test } from "node:test";

import { GitHub } from "./github.mjs";

const ok = (data = {}) => ({
  status: 0,
  stdout: JSON.stringify(data),
  stderr: "",
});

function recording(replyFor = () => ok()) {
  const calls = [];
  const exec = (args, input) => {
    calls.push({ args, input });
    return replyFor(args, input);
  };
  const github = new GitHub({
    repo: "owner/name",
    exec,
    sleep: async () => {},
    log: () => {},
    paceMs: 0,
  });
  return { github, calls };
}

test("a dry run never sends a write or a mutation", async () => {
  const lines = [];
  const calls = [];
  const github = new GitHub({
    repo: "owner/name",
    dryRun: true,
    log: (line) => lines.push(line),
    exec: (args) => {
      calls.push(args);
      return ok();
    },
  });
  const written = await github.write("do a thing", "POST", "repos/x", {});
  const mutated = await github.mutate("do another", "mutation { a }");
  assert.equal(written, null);
  assert.equal(mutated, null);
  assert.deepEqual(calls, []);
  assert.deepEqual(lines, ["would do a thing", "would do another"]);
});

test("a dry run still reads", async () => {
  const { github, calls } = recording(() => ok({ answer: 42 }));
  github.dryRun = true;
  assert.deepEqual(await github.get("repos/x"), { answer: 42 });
  assert.equal(calls.length, 1);
});

test("query() refuses a mutation, so none can pass as a read", async () => {
  const { github, calls } = recording();
  github.dryRun = true;
  await assert.rejects(
    () => github.query("  mutation { deleteProjectV2 }"),
    /only reads/,
  );
  assert.deepEqual(calls, []);
});

test("a label with odd characters travels in the JSON body, never as an argument", async () => {
  const { github, calls } = recording();
  const label = "test: a, b and c";
  await github.write("label", "POST", "repos/x/issues", { labels: [label] });
  const [{ args, input }] = calls;
  assert.equal(args.join(" ").includes(label), false);
  assert.deepEqual(args.slice(-2), ["--input", "-"]);
  assert.deepEqual(JSON.parse(input), { labels: [label] });
});

test("GraphQL variables travel on stdin too", async () => {
  const { github, calls } = recording(() => ok({ data: { ok: true } }));
  const data = await github.query("query { a }", { title: "x, y" });
  assert.deepEqual(data, { ok: true });
  assert.deepEqual(calls[0].args, ["api", "graphql", "--input", "-"]);
  assert.deepEqual(JSON.parse(calls[0].input).variables, { title: "x, y" });
});

test("getAll follows pages and flattens them", async () => {
  const { github, calls } = recording(() => ok([[{ a: 1 }], [{ a: 2 }]]));
  assert.deepEqual(await github.getAll("repos/x/labels"), [{ a: 1 }, { a: 2 }]);
  assert.ok(calls[0].args.includes("--paginate"));
  assert.equal(calls[0].args.at(-1), "repos/x/labels?per_page=100");
});

test("getAll keeps a query string that is already there", async () => {
  const { github, calls } = recording(() => ok([[]]));
  await github.getAll("repos/x/milestones?state=all");
  assert.equal(
    calls[0].args.at(-1),
    "repos/x/milestones?state=all&per_page=100",
  );
});

test("a secondary rate limit waits and tries again", async () => {
  let attempts = 0;
  const waits = [];
  const github = new GitHub({
    repo: "owner/name",
    paceMs: 0,
    log: () => {},
    sleep: async (ms) => waits.push(ms),
    exec: () => {
      attempts += 1;
      return attempts < 3
        ? {
            status: 1,
            stdout: "",
            stderr: "You have exceeded a secondary rate limit",
          }
        : ok({ fine: true });
    },
  });
  assert.deepEqual(await github.write("x", "POST", "repos/x", {}), {
    fine: true,
  });
  assert.equal(attempts, 3);
  assert.deepEqual(waits.slice(0, 2), [60_000, 120_000]);
});

test("any other failure stops at once, with GitHub's message", async () => {
  let attempts = 0;
  const github = new GitHub({
    repo: "owner/name",
    log: () => {},
    sleep: async () => {},
    exec: () => {
      attempts += 1;
      return { status: 1, stdout: "", stderr: "HTTP 422: Validation Failed" };
    },
  });
  await assert.rejects(() => github.get("repos/x"), /HTTP 422/);
  assert.equal(attempts, 1);
});

test("GraphQL errors are failures, even with exit status 0", async () => {
  const { github } = recording(() => ok({ errors: [{ message: "nope" }] }));
  await assert.rejects(() => github.query("query { a }"), /nope/);
});

test("the repository comes from the Actions environment when it is set", () => {
  const saved = process.env.GITHUB_REPOSITORY;
  process.env.GITHUB_REPOSITORY = "someone/else";
  try {
    const github = new GitHub({ exec: () => ok(), log: () => {} });
    assert.equal(github.owner, "someone");
    assert.equal(github.name, "else");
  } finally {
    if (saved === undefined) delete process.env.GITHUB_REPOSITORY;
    else process.env.GITHUB_REPOSITORY = saved;
  }
});
