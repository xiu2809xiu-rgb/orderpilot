import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BLOCK_END,
  BLOCK_START,
  keyFromTitle,
  mergeBody,
  mergeLabels,
  renderEpicBlock,
  renderStoryBlock,
  sameBody,
  sameSet,
  storyLabels,
} from "./backlog.mjs";
import { loadBacklog, loadLabels } from "./catalogue.mjs";

const block = (lines) => [BLOCK_START, ...lines, BLOCK_END].join("\n");

test("keys come from the start of the title", () => {
  assert.equal(keyFromTitle("P-3: The problem"), "P-3");
  assert.equal(keyFromTitle("P-25: Slides as code"), "P-25");
  assert.equal(keyFromTitle("  C-1: Area 2 base"), "C-1");
  assert.equal(keyFromTitle("Epic P: The platform base"), "Epic P");
});

test("a title with no key at the start has none", () => {
  assert.equal(keyFromTitle("docs: add the ground rules (P-1)"), null);
  assert.equal(keyFromTitle("Fix the P-3: heading"), null);
  assert.equal(keyFromTitle("p-3: lower case"), null);
});

test("a new issue's body holds the managed block", () => {
  const body = mergeBody("", block(["text"]));
  assert.equal(body, `${block(["text"])}\n`);
});

test("adopting a hand-written issue keeps its words under the block", () => {
  const body = mergeBody("Written by hand.", block(["text"]));
  assert.equal(body, `${block(["text"])}\n\nWritten by hand.\n`);
});

test("a re-run leaves an identical body alone", () => {
  const first = mergeBody("Written by hand.", block(["text"]));
  assert.equal(mergeBody(first, block(["text"])), first);
});

test("a change in the data replaces only the block", () => {
  const first = `Above.\n\n${block(["old"])}\n\nBelow.\n`;
  const next = mergeBody(first, block(["new"]));
  assert.equal(next, `Above.\n\n${block(["new"])}\n\nBelow.\n`);
});

test("a ticked box stays ticked while its text is unchanged", () => {
  const current = block(["- [x] Done already", "- [ ] Not yet"]);
  const wanted = block(["- [ ] Done already", "- [ ] Not yet", "- [ ] New"]);
  assert.equal(
    mergeBody(current, wanted),
    block(["- [x] Done already", "- [ ] Not yet", "- [ ] New"]),
  );
});

test("a reworded criterion comes back unticked", () => {
  const current = block(["- [x] Old wording"]);
  const wanted = block(["- [ ] New wording"]);
  assert.equal(mergeBody(current, wanted), wanted);
});

test("the web editor's line endings do not count as a change", () => {
  const stored = block(["- [ ] One"]).replace(/\n/g, "\r\n");
  const merged = mergeBody(stored, block(["- [ ] One"]));
  assert.ok(sameBody(merged, stored));
});

test("only the managed label prefixes are replaced", () => {
  const merged = mergeLabels(
    ["priority: should", "status: blocked", "dependencies", "req: M1 x"],
    ["type: story", "priority: must"],
  );
  assert.deepEqual(merged, [
    "type: story",
    "priority: must",
    "status: blocked",
    "dependencies",
  ]);
});

test("label sets compare without regard to order", () => {
  assert.ok(sameSet(["a", "b"], ["b", "a"]));
  assert.equal(sameSet(["a", "b"], ["a"]), false);
  assert.equal(sameSet(["a"], ["a", "b"]), false);
});

test("a story's block carries its facts and its criteria as checkboxes", () => {
  const backlog = loadBacklog();
  const labels = loadLabels();
  const story = backlog.stories.find((item) => item.key === "P-2");
  const text = renderStoryBlock(story, backlog, labels);
  assert.ok(text.startsWith(BLOCK_START));
  assert.ok(text.endsWith(BLOCK_END));
  assert.ok(text.includes("- **Estimate:** 8 points"));
  assert.ok(text.includes("- **Branch:** `chore/github-process`"));
  assert.ok(
    text.includes(
      "- **Requirements:** M4 best practices, M5 team Git workflow",
    ),
  );
  assert.equal(
    (text.match(/^- \[ \] /gm) ?? []).length,
    story.acceptance.length,
  );
});

test("an epic's block counts its stories and points", () => {
  const backlog = loadBacklog();
  const epic = backlog.epics.find((item) => item.key === "F");
  const text = renderEpicBlock(epic, backlog, loadLabels());
  // F-1 and F-2, the starter stories F-3 to F-5, then P-10's follow-ups F-6 and F-7.
  assert.ok(text.includes("- **Stories:** 7, worth 32 points"));
});

test("a story's labels are its type, area, priority and requirements", () => {
  const backlog = loadBacklog();
  const story = backlog.stories.find((item) => item.key === "D-1");
  assert.deepEqual(storyLabels(story, loadLabels()), [
    "type: story",
    "area: 3 checks tracker and insights",
    "priority: must",
    "req: M4 best practices",
  ]);
});
