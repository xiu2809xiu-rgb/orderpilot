// Guards the rule that lets two required jobs skip. A wrong "skip" would pass a broken
// image with a green check, so these tests lean towards that failure.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { changedFiles, decide } from "./changed-inputs.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
/** @param {string} file */
const read = (file) => readFileSync(path.join(root, file), "utf8");
const both = { images: true, e2e: true };
const neither = { images: false, e2e: false };

test("a change to docs, Markdown or repository scripts needs neither job", () => {
  for (const file of [
    "docs/BUILD_REPORT.md",
    "docs/design/screenshots/product-pass/support-home-1440.png",
    "README.md",
    "apps/web/public/demo-documents/README.md",
    "samples/README.md",
    "scripts/github/data/backlog.json",
    "scripts/check-dashes.mjs",
    ".github/labels.json",
    ".github/rulesets/main.json",
    ".github/workflows/security.yml",
    ".github/workflows/sprint-recorder.yml",
    ".github/dependabot.yml",
    ".githooks/pre-commit",
    "eslint.config.js",
    "docker-compose.samples.yml",
  ]) {
    assert.deepEqual(decide("pull_request", [file]), neither, file);
    assert.deepEqual(decide("push", [file]), neither, file);
  }
});

test("a change to the code or the build needs both jobs", () => {
  for (const file of [
    "apps/api/src/main.ts",
    "apps/api/prisma/schema/base.prisma",
    "apps/api/Dockerfile",
    "apps/web/src/App.tsx",
    "apps/web/nginx/default.conf.template",
    "apps/web/public/demo-documents/po-letter-so-0041.pdf",
    "packages/shared/src/index.ts",
    "services/mock-business-central/src/main.ts",
    "docker/minio/Dockerfile",
    "docker/mock/Dockerfile",
    "docker-compose.yml",
    ".dockerignore",
    ".env.example",
    ".node-version",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.json",
    "scripts/ci/changed-inputs.mjs",
    "scripts/stack-smoke.mjs",
    "apps/api/src/prompts/extract.md",
    "packages/shared/src/rules.md",
  ]) {
    assert.deepEqual(decide("pull_request", [file]), both, file);
  }
});

test("anything nobody has listed runs both, so a new folder fails safe", () => {
  for (const file of [
    "infra/deploy/docker-compose.prod.yml",
    "assets-src/3d/scene.py",
    "new-file",
  ]) {
    assert.deepEqual(decide("pull_request", [file]), both, file);
  }
});

test("each job also runs for what only it uses, and not for the other's", () => {
  assert.deepEqual(decide("pull_request", ["apps/e2e/tests/smoke.spec.ts"]), {
    images: false,
    e2e: true,
  });
  assert.deepEqual(decide("pull_request", [".github/workflows/ci.yml"]), {
    images: false,
    e2e: true,
  });
  assert.deepEqual(decide("pull_request", [".github/workflows/docker.yml"]), {
    images: true,
    e2e: false,
  });
  assert.deepEqual(decide("pull_request", [".trivyignore"]), {
    images: true,
    e2e: false,
  });
});

test("one input among many docs is enough", () => {
  assert.deepEqual(
    decide("pull_request", ["docs/a.md", "docs/b.png", "apps/api/src/x.ts"]),
    both,
  );
});

test("a schedule, a manual run or an empty diff runs everything", () => {
  assert.deepEqual(decide("schedule", ["docs/a.md"]), both);
  assert.deepEqual(decide("workflow_dispatch", ["docs/a.md"]), both);
  assert.deepEqual(decide("pull_request", []), both);
});

test("every path a Dockerfile copies is an input of the images job", () => {
  const dockerfiles = [
    "apps/api/Dockerfile",
    "apps/web/Dockerfile",
    "docker/minio/Dockerfile",
    "docker/mock/Dockerfile",
  ];
  let seen = 0;
  for (const dockerfile of dockerfiles) {
    for (const line of read(dockerfile).split("\n")) {
      const copy = /^\s*(?:COPY|ADD)\s+(?!--from)(.+)$/.exec(line);
      if (!copy?.[1]) continue;
      const parts = copy[1]
        .trim()
        .split(/\s+/)
        .filter((part) => !part.startsWith("--"));
      for (const source of parts.slice(0, -1)) {
        seen += 1;
        const file = source
          .replace(/\$\{SERVICE\}/, "mock-business-central")
          .replace(/\/$/, "");
        assert.equal(
          decide("pull_request", [`${file}/x`]).images,
          true,
          `${dockerfile}: ${source}`,
        );
        assert.equal(
          decide("pull_request", [file]).images,
          true,
          `${dockerfile}: ${source}`,
        );
      }
    }
  }
  assert.ok(seen >= 10, `found only ${seen} COPY sources`);
});

test("every repository file the end-to-end package imports is one of its inputs", () => {
  const folders = ["apps/e2e/src", "apps/e2e/tests"];
  let seen = 0;
  for (const folder of folders) {
    for (const entry of readdirSync(path.join(root, folder), {
      recursive: true,
    })) {
      const file = path.posix.join(folder, String(entry).replaceAll("\\", "/"));
      if (!/\.(?:ts|mjs)$/.test(file)) continue;
      for (const match of read(file).matchAll(/from "(\.\.?\/[^"]+)"/g)) {
        const imported = path.posix.join(
          path.posix.dirname(file),
          String(match[1]),
        );
        if (imported.startsWith("apps/e2e/")) continue;
        seen += 1;
        assert.equal(
          decide("pull_request", [imported]).e2e,
          true,
          `${file}: ${imported}`,
        );
      }
    }
  }
  assert.ok(
    seen >= 1,
    "expected the end-to-end package to import the smoke script",
  );
});

test("the diff is the commit against its first parent, renames count twice", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "changed-inputs-"));
  /** @param {string[]} args */
  const git = (...args) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      {
        cwd: dir,
        encoding: "utf8",
      },
    );
  try {
    git("init", "-q", "-b", "main");
    writeFileSync(path.join(dir, "base.txt"), "base\n");
    writeFileSync(
      path.join(dir, "old.txt"),
      "same content in both\n".repeat(20),
    );
    git("add", ".");
    git("commit", "-qm", "base");
    git("switch", "-qc", "topic");
    git("mv", "old.txt", "new.txt");
    git("commit", "-qm", "rename");
    git("switch", "-q", "main");
    // Main moves on: this file must not count as part of the merged branch.
    writeFileSync(path.join(dir, "other.txt"), "other\n");
    git("add", ".");
    git("commit", "-qm", "main moves");
    git("merge", "-q", "--no-ff", "-m", "merge topic", "topic");
    assert.deepEqual(changedFiles(dir).sort(), ["new.txt", "old.txt"]);
    // A root commit has no first parent, which the caller turns into "run everything".
    git("checkout", "-q", "--orphan", "lonely");
    git("commit", "-qm", "root");
    assert.throws(() => changedFiles(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The workflows are read as text, as workflow.test.mjs does: scripts here have no
// dependencies, so no YAML parser.
/** @param {string} file */
const code = (file) =>
  read(file)
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
/**
 * @param {string} file
 * @param {string} job
 */
const jobBlock = (file, job) => {
  const lines = code(file).split("\n");
  const start = lines.indexOf(`  ${job}:`);
  assert.ok(start >= 0, `${file} has no job ${job}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));
  return rest.slice(0, end < 0 ? undefined : end).join("\n");
};

test("no workflow filters by path, which would strand a required check", () => {
  for (const file of ["ci", "docker", "security", "sprint-recorder"]) {
    assert.doesNotMatch(
      code(`.github/workflows/${file}.yml`),
      /^\s*paths(-ignore)?:/m,
      file,
    );
  }
});

test("a push runs a workflow only on main", () => {
  for (const file of ["ci", "docker", "security"]) {
    assert.match(
      code(`.github/workflows/${file}.yml`),
      /^ {2}push:\n {4}branches: \[main\]$/m,
      file,
    );
  }
});

test("the end-to-end job waits for verify and asks it whether to run", () => {
  const verify = jobBlock(".github/workflows/ci.yml", "verify");
  assert.match(
    verify,
    /outputs:\n\s+e2e: \$\{\{ steps\.inputs\.outputs\.e2e \}\}/,
  );
  assert.match(
    verify,
    /id: inputs\n\s+run: node scripts\/ci\/changed-inputs\.mjs/,
  );
  const e2e = jobBlock(".github/workflows/ci.yml", "e2e");
  assert.match(e2e, /name: End-to-end smoke/);
  assert.match(e2e, /needs: verify/);
  // Compared with 'false' so that an empty answer runs the job.
  assert.match(e2e, /if: needs\.verify\.outputs\.e2e != 'false'/);
});

test("the images job waits for the IaC scan and asks it whether to run", () => {
  const config = jobBlock(".github/workflows/docker.yml", "config");
  assert.match(config, /name: IaC and Dockerfile scan/);
  assert.match(
    config,
    /outputs:\n\s+images: \$\{\{ steps\.inputs\.outputs\.images \}\}/,
  );
  assert.match(config, /fetch-depth: 2/);
  assert.match(
    config,
    /id: inputs\n\s+run: node scripts\/ci\/changed-inputs\.mjs/,
  );
  const images = jobBlock(".github/workflows/docker.yml", "images");
  assert.match(images, /name: Docker images/);
  assert.match(images, /needs: config/);
  assert.match(images, /if: needs\.config\.outputs\.images != 'false'/);
});
