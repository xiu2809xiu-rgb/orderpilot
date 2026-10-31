import { reqLabel } from "./catalogue.mjs";
import { sprintTitle } from "./sprint-calendar.mjs";

export const BLOCK_START = "<!-- backlog:start -->";
export const BLOCK_END = "<!-- backlog:end -->";

// `scripts/github/data/backlog.json` owns these prefixes. Anything else on an
// issue, such as `status: blocked`, belongs to the people working on it.
const MANAGED_LABEL = /^(type|area|priority|req): /;

const TICKED = /^- \[[xX]\] /;
const UNTICKED = "- [ ] ";
const TICK = "- [x] ";

// A starter story is refined enough to pull, so it starts at Ready on the board.
export const READY_FACT = "Ready to pull, at Ready on the board";

export const epicKey = (epic) => `Epic ${epic.key}`;
export const epicTitle = (epic) => `${epicKey(epic)}: ${epic.title}`;
export const storyTitle = (story) => `${story.key}: ${story.title}`;

// The key, not the whole title, is what ties an issue to the data, so that a
// renamed story keeps its issue.
export function keyFromTitle(title) {
  const trimmed = title.trim();
  const story = trimmed.match(/^([A-Z]-\d+):/);
  if (story) return story[1];
  const epic = trimmed.match(/^Epic ([A-Z]):/);
  return epic ? `Epic ${epic[1]}` : null;
}

export function storiesOf(backlog, epic) {
  return backlog.stories.filter((story) => story.epic === epic.key);
}

export function storyLabels(story, labels) {
  return [
    "type: story",
    story.area,
    `priority: ${story.priority}`,
    ...story.reqs.map((req) => reqLabel(labels, req)),
  ];
}

export function epicReqs(backlog, epic) {
  const reqs = storiesOf(backlog, epic).flatMap((story) => story.reqs);
  return [...new Set(reqs)].sort();
}

export function epicLabels(backlog, epic, labels) {
  return [
    "type: epic",
    epic.area,
    `priority: ${epic.priority}`,
    ...epicReqs(backlog, epic).map((req) => reqLabel(labels, req)),
  ];
}

export function reqNames(reqs, labels) {
  return reqs
    .map((req) => reqLabel(labels, req).replace("req: ", ""))
    .join(", ");
}

export function sprintList(story) {
  return (story.sprints ?? []).map(sprintTitle).join(" and ");
}

export function storyFacts(story, backlog, labels) {
  const epic = backlog.epics.find((item) => item.key === story.epic);
  const facts = [
    ["Epic", epicTitle(epic)],
    ["Area", `\`${story.area}\``],
    ["Priority", story.priority],
    ["Estimate", `${story.estimate} points`],
    ["Requirements", reqNames(story.reqs, labels)],
  ];
  if (story.branch) facts.push(["Branch", `\`${story.branch}\``]);
  if (story.sprints) facts.push(["Planned for", sprintList(story)]);
  if (story.ready) facts.push(["Ready", READY_FACT]);
  if (story.dependsOn.length > 0) {
    facts.push(["Depends on", story.dependsOn.join(", ")]);
  }
  if (story.condition) facts.push(["Condition", story.condition]);
  return facts;
}

const factLines = (facts) =>
  facts.map(([name, value]) => `- **${name}:** ${value}`).join("\n");

const FOOTER =
  "The block above comes from `scripts/github/data/backlog.json`. Change it there. Anything you add below it stays.";

// `done` ticks every criterion, for a story finished before the seed adopted
// its issue: its pull request met them, and an unticked list on a closed issue
// would read as work left undone.
export function renderStoryBlock(
  story,
  backlog,
  labels,
  { done = false } = {},
) {
  const box = done ? TICK : UNTICKED;
  const criteria = story.acceptance.map((line) => `${box}${line}`).join("\n");
  return [
    BLOCK_START,
    story.summary,
    "",
    factLines(storyFacts(story, backlog, labels)),
    "",
    "## Acceptance criteria",
    "",
    criteria,
    "",
    FOOTER,
    BLOCK_END,
  ].join("\n");
}

export function renderEpicBlock(epic, backlog, labels) {
  const stories = storiesOf(backlog, epic);
  const points = stories.reduce((sum, story) => sum + story.estimate, 0);
  return [
    BLOCK_START,
    epic.summary,
    "",
    factLines([
      ["Area", `\`${epic.area}\``],
      ["Priority", epic.priority],
      ["Stories", `${stories.length}, worth ${points} points`],
      ["Requirements", reqNames(epicReqs(backlog, epic), labels)],
    ]),
    "",
    "Its stories are the sub-issues of this issue.",
    "",
    FOOTER,
    BLOCK_END,
  ].join("\n");
}

function keepTicks(current, next) {
  const ticked = new Set(
    current
      .split("\n")
      .filter((line) => TICKED.test(line))
      .map((line) => line.slice(UNTICKED.length)),
  );
  return next
    .split("\n")
    .map((line) => {
      const text = line.slice(UNTICKED.length);
      return line.startsWith(UNTICKED) && ticked.has(text)
        ? `- [x] ${text}`
        : line;
    })
    .join("\n");
}

// Issue bodies belong to people as well as to the data: a ticked box or a note
// must survive every re-run. Only the block between the markers is ours.
export function hasBlock(body) {
  const text = body ?? "";
  return text.includes(BLOCK_START) && text.includes(BLOCK_END);
}

export function mergeBody(existing, block) {
  const body = (existing ?? "").replace(/\r\n/g, "\n");
  const start = body.indexOf(BLOCK_START);
  const end = body.indexOf(BLOCK_END);
  if (start === -1 || end === -1) {
    const rest = body.trim();
    return rest ? `${block}\n\n${rest}\n` : `${block}\n`;
  }
  const current = body.slice(start, end + BLOCK_END.length);
  const before = body.slice(0, start);
  const after = body.slice(end + BLOCK_END.length);
  return `${before}${keepTicks(current, block)}${after}`;
}

const normalised = (text) => (text ?? "").replace(/\r\n/g, "\n").trimEnd();

export function sameBody(left, right) {
  return normalised(left) === normalised(right);
}

export function mergeLabels(current, wanted) {
  const kept = current.filter((name) => !MANAGED_LABEL.test(name));
  return [...new Set([...wanted, ...kept])];
}

export function sameSet(left, right) {
  const other = new Set(right);
  return left.length === other.size && left.every((item) => other.has(item));
}
