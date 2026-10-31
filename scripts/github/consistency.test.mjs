// The area and requirement names live in several files that GitHub reads
// separately. These tests fail if any of them drifts from the brief's words.

import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";

import { wantedAreaOptions } from "./lib/board.mjs";
import { areaLabels, loadBacklog, loadLabels } from "./lib/catalogue.mjs";
import { readRepoFile, repoPath } from "./lib/files.mjs";

const labels = loadLabels();
const names = labels.map((label) => label.name);

const BRIEF_AREAS = [
  "area: 1 document AI and integration",
  "area: 2 order workflows and approvals",
  "area: 3 checks tracker and insights",
  "area: 4 controls and monitoring",
  "area: team",
];
const BRIEF_REQS = [
  "req: M1 design thinking",
  "req: M2 GRS by design",
  "req: M3 AI-assisted coding",
  "req: M4 best practices",
  "req: M5 team Git workflow",
  "req: M6 deploy and monitor",
];
const FORMS = ["story", "task", "epic", "spike", "bug"];

const form = (name) => readRepoFile(`.github/ISSUE_TEMPLATE/${name}.yml`);
const template = () => readRepoFile(".github/PULL_REQUEST_TEMPLATE.md");

test("the labels are exactly the ones the brief lists", () => {
  assert.deepEqual(names, [
    "type: epic",
    "type: story",
    "type: task",
    "type: bug",
    "type: spike",
    "type: chore",
    "type: docs",
    "type: security",
    ...BRIEF_AREAS,
    "priority: must",
    "priority: should",
    "priority: could",
    ...BRIEF_REQS,
    "status: blocked",
    "status: needs client input",
    "dependencies",
  ]);
});

test("each requirement's name is the one in the brief", () => {
  const brief = readRepoFile("docs/ai/prompts/001-build-the-base.md");
  for (const label of BRIEF_REQS) {
    assert.ok(brief.includes(label.replace("req: ", "")), label);
  }
});

test("every label is one GitHub will accept", () => {
  assert.equal(new Set(names).size, names.length);
  for (const { name, color, description } of labels) {
    assert.ok(name.length <= 50, name);
    assert.match(color, /^[0-9a-f]{6}$/, name);
    assert.ok(description.length > 0 && description.length <= 100, name);
  }
});

test("each form applies its own type label", () => {
  for (const name of FORMS) {
    const label = `type: ${name}`;
    assert.ok(names.includes(label));
    assert.ok(form(name).includes(`  - "${label}"`), name);
  }
});

test("each form offers exactly the area labels, in order", () => {
  for (const name of FORMS) {
    const offered = [...form(name).matchAll(/^\s+- "(area: [^"]+)"$/gm)].map(
      (match) => match[1],
    );
    assert.deepEqual(offered, areaLabels(labels), name);
  }
});

test("no form sets an area as a label, where the CLI could split it", () => {
  for (const name of FORMS) {
    const header = form(name).split(/^body:/m)[0];
    assert.equal(header.includes("area:"), false, name);
  }
});

test("the story form offers the priorities, estimates and requirements", () => {
  const text = form("story");
  for (const priority of ["must", "should", "could"]) {
    assert.ok(text.includes(`- "priority: ${priority}"`), priority);
  }
  for (const label of BRIEF_REQS) {
    assert.ok(text.includes(`- label: "${label}"`), label);
  }
  for (const point of [1, 2, 3, 5, 8, 13]) {
    assert.ok(text.includes(`- "${point}"`), String(point));
  }
});

test("blank issues are off, with the right contact links", () => {
  const text = readRepoFile(".github/ISSUE_TEMPLATE/config.yml");
  assert.ok(text.includes("blank_issues_enabled: false"));
  assert.ok(
    text.includes(
      "https://github.com/xiu2809xiu-rgb/orderpilot/security/advisories/new",
    ),
  );
  assert.ok(
    text.includes(
      "https://github.com/xiu2809xiu-rgb/orderpilot/tree/main/docs",
    ),
  );
});

test("the pull request template lists every area and requirement", () => {
  const text = template();
  for (const label of [...BRIEF_AREAS, ...BRIEF_REQS]) {
    assert.ok(text.includes(`- [ ] \`${label}\``), label);
  }
});

test("the pull request template covers everything rule 3 and the brief ask", () => {
  const text = template();
  for (const heading of [
    "Closes #",
    "## What and why",
    "## Area",
    "## Module requirements",
    "## Acceptance criteria and evidence",
    "## Results",
    "## UI checklist",
    "## Docs",
    "## Data and security",
    "## Definition of Done",
  ]) {
    assert.ok(text.includes(heading), heading);
  }
  for (const command of [
    "`pnpm lint`",
    "`pnpm typecheck`",
    "`pnpm test`",
    "`pnpm build`",
    "`docker compose up --build`",
  ]) {
    assert.ok(text.includes(command), command);
  }
  assert.ok(text.includes("docs/design/screenshots/<area>/"));
});

test("the board's Area options are the area labels without their prefix", () => {
  assert.deepEqual(
    wantedAreaOptions(labels).map((option) => option.name),
    BRIEF_AREAS.map((label) => label.slice("area: ".length)),
  );
});

test("the backlog only uses area labels that exist", () => {
  const { epics, stories } = loadBacklog();
  for (const item of [...epics, ...stories]) {
    assert.ok(BRIEF_AREAS.includes(item.area), item.key);
  }
});

const OWNER_HANDLES = [
  "@xiu2809xiu-rgb",
  "@MaineJermaine",
  "@ITnyp",
  "@angelynnmr",
];

const codeownersRules = () =>
  readRepoFile(".github/CODEOWNERS")
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith("#"))
    .map((line) => line.trim().split(/\s+/));

// Enough of CODEOWNERS matching for the paths tested here: a leading slash
// anchors the pattern, a trailing slash means a folder, and * stays in a segment.
const patternMatches = (pattern, path) => {
  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${source}`).test(path);
};

test("CODEOWNERS starts with a catch-all for area 1 and uses only the four handles", () => {
  const rules = codeownersRules();
  assert.deepEqual(rules[0], ["*", "@xiu2809xiu-rgb", "@angelynnmr"]);
  for (const [, ...owners] of rules) {
    for (const owner of owners) assert.ok(OWNER_HANDLES.includes(owner), owner);
  }
});

test("every CODEOWNERS rule has at least two distinct owners", () => {
  for (const [path, ...owners] of codeownersRules()) {
    assert.ok(new Set(owners).size >= 2, path);
  }
});

test("CODEOWNERS has no placeholders left", () => {
  const text = readRepoFile(".github/CODEOWNERS");
  assert.ok(!/<[^>]*>/.test(text));
  assert.ok(!text.includes("TBD"));
});

test("each area's own guide resolves to that area's owners (last match wins)", () => {
  const rules = codeownersRules().slice(1);
  const ownersOf = (path) =>
    [...rules]
      .reverse()
      .find(([pattern]) => patternMatches(pattern, path))
      .slice(1);
  assert.ok(ownersOf("/docs/team/area-2-x.md").includes("@MaineJermaine"));
  assert.ok(ownersOf("/docs/team/area-3-x.md").includes("@ITnyp"));
  assert.ok(ownersOf("/docs/team/area-4-x.md").includes("@angelynnmr"));
  assert.equal(ownersOf("/docs/adr/0001.md").length, 4);
});

test("every wiki link to another page names a page that exists", () => {
  const pages = readdirSync(repoPath("docs/wiki")).filter((name) =>
    name.endsWith(".md"),
  );
  const known = new Set(pages.map((name) => name.replace(/\.md$/, "")));
  for (const page of pages) {
    const text = readRepoFile(`docs/wiki/${page}`);
    // GitHub's wiki links pages by name, without `.md` and without a path.
    for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^(https?:|mailto:)/.test(target)) continue;
      assert.ok(known.has(target), `${page} links to ${target}`);
    }
  }
});

test("the wiki has the pages the brief lists", () => {
  const pages = readdirSync(repoPath("docs/wiki")).sort();
  assert.deepEqual(pages, [
    "Definition-of-Done.md",
    "Getting-started.md",
    "Home.md",
    "How-we-work.md",
    "Security.md",
    "Sprint-calendar.md",
    "Team-and-areas.md",
    "_Sidebar.md",
  ]);
});

test("no label has a comma, because GitHub refuses it", () => {
  for (const { name } of labels) {
    assert.equal(name.includes(","), false, name);
  }
});
