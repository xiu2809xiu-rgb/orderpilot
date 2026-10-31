import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { loadBacklog, loadLabels, loadSprintGoals } from "./lib/catalogue.mjs";
import { repoPath } from "./lib/files.mjs";
import { markdownTable, renderSprintCalendar } from "./lib/render.mjs";
import { renderedFiles } from "./render-docs.mjs";

const WIKI = "docs/wiki";
const PAGES = [
  "Definition-of-Done.md",
  "Getting-started.md",
  "Home.md",
  "How-we-work.md",
  "Security.md",
  "Sprint-calendar.md",
  "Team-and-areas.md",
  "_Sidebar.md",
];

const wikiFiles = () =>
  readdirSync(repoPath(WIKI))
    .filter((name) => name.endsWith(".md"))
    .sort();
const wikiPage = (name) => readFileSync(repoPath(`${WIKI}/${name}`), "utf8");
const links = (text) =>
  [...text.matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1]);

test("the committed rendered files match the data", () => {
  for (const { path, text } of renderedFiles()) {
    assert.equal(readFileSync(repoPath(path), "utf8"), text, path);
  }
});

test("a table is padded the way Prettier pads one", () => {
  assert.equal(
    markdownTable(["A", "Longer"], [["one", 2]]),
    ["| A   | Longer |", "| --- | ------ |", "| one | 2      |"].join("\n"),
  );
});

test("the backlog page has every epic and story", () => {
  const backlog = loadBacklog();
  const [{ text }] = renderedFiles();
  for (const epic of backlog.epics) {
    assert.ok(text.includes(`## Epic ${epic.key}: ${epic.title}`), epic.key);
  }
  for (const story of backlog.stories) {
    assert.ok(text.includes(`### ${story.key}: ${story.title}`), story.key);
    for (const line of story.acceptance) {
      assert.ok(text.includes(`- ${line}\n`), `${story.key}: ${line}`);
    }
  }
});

test("the calendar lists all 18 sprints with their goals and stories", () => {
  const text = renderSprintCalendar(loadSprintGoals(), loadBacklog());
  for (const { goal } of loadSprintGoals()) assert.ok(text.includes(goal));
  assert.ok(text.includes("Sprint 01 (W2)"));
  assert.ok(text.includes("Sprint 18 (W19)"));
  assert.match(text, /Sprint 03 \(W4\).*T-4, T-6, T-7/);
});

test("the wiki has exactly the pages the brief lists", () => {
  assert.deepEqual(wikiFiles(), PAGES);
});

test("links between wiki pages use the wiki's own form and resolve", () => {
  const pages = new Set(wikiFiles().map((name) => name.replace(".md", "")));
  for (const name of wikiFiles()) {
    for (const target of links(wikiPage(name))) {
      if (target.startsWith("https://")) continue;
      const page = target.split("#")[0];
      assert.ok(pages.has(page), `${name} links to ${target}`);
      assert.equal(page.includes("/"), false, `${name} links to ${target}`);
    }
  }
});

test("links out of the wiki are absolute, so they work on the wiki", () => {
  for (const name of wikiFiles()) {
    for (const target of links(wikiPage(name))) {
      assert.equal(
        target.endsWith(".md") && !target.startsWith("https"),
        false,
      );
    }
  }
});

test("the sidebar reaches every page", () => {
  const sidebar = links(wikiPage("_Sidebar.md"));
  for (const name of PAGES.filter((page) => page !== "_Sidebar.md")) {
    assert.ok(sidebar.includes(name.replace(".md", "")), name);
  }
});

test("Getting started says what does not work yet", () => {
  const text = wikiPage("Getting-started.md");
  assert.ok(text.includes("`pnpm install` does not work yet"));
  assert.ok(text.includes("P-5"));
});

test("Team and areas names every area label", () => {
  const text = wikiPage("Team-and-areas.md");
  const areas = loadLabels().filter((label) => label.name.startsWith("area: "));
  for (const { name } of areas) assert.ok(text.includes(name), name);
});
