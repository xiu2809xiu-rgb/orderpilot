// Prints what closed this sprint and what is in progress, by area.
// Usage: node scripts/github/sprint-report.mjs [--sprint <n>] [--date <yyyy-mm-dd>]
//
// It only reads, so --dry-run changes nothing and is accepted for symmetry.

import { findBoard, readBoardItems } from "./lib/board.mjs";
import { areaLabels, loadLabels, loadSprintGoals } from "./lib/catalogue.mjs";
import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { GitHub } from "./lib/github.mjs";
import { readIssues, readPullRequests } from "./lib/issues.mjs";
import {
  formatDay,
  moduleWeek,
  singaporeDate,
  sprintDates,
  sprintForDate,
  sprintTitle,
} from "./lib/sprint-calendar.mjs";

const NO_AREA = "no area";

// An issue form records its area in the body until someone adds the label, and
// a story must not fall out of its area's section because of that.
export function areaOf(issue, areas) {
  const label = issue.labels.find((name) => areas.includes(name));
  if (label) return label;
  const form = (issue.body ?? "").match(/^### Area\s+(area: [^\r\n]+)/m);
  return form && areas.includes(form[1].trim()) ? form[1].trim() : NO_AREA;
}

export function closedIn(issues, sprint) {
  const { monday, sunday } = sprintDates(sprint);
  return issues.filter((issue) => {
    if (issue.state !== "CLOSED" || !issue.closedAt) return false;
    const closed = singaporeDate(issue.closedAt);
    return closed >= monday && closed <= sunday;
  });
}

// The board says what is in progress once it exists. Before that, or for an
// issue nobody has moved yet, an open pull request or an assignee is the signal.
export function inProgress(issues, pulls, boardItems) {
  const onBoard = new Map(boardItems.map((item) => [item.number, item.status]));
  const withPull = new Set(
    pulls
      .filter((pull) => pull.state === "OPEN")
      .flatMap((pull) => pull.closes),
  );
  return issues.filter((issue) => {
    if (issue.state !== "OPEN") return false;
    const status = onBoard.get(issue.number);
    if (status && status !== "Todo") return status === "In Progress";
    return withPull.has(issue.number) || issue.assignees.length > 0;
  });
}

function groupLines(issues, areas, describe) {
  if (issues.length === 0) return ["  None."];
  const lines = [];
  for (const area of [...areas, NO_AREA]) {
    const inArea = issues.filter((issue) => areaOf(issue, areas) === area);
    if (inArea.length === 0) continue;
    lines.push(`  ${area}`);
    for (const issue of inArea) lines.push(`    ${describe(issue)}`);
  }
  return lines;
}

export function buildReport({
  sprint,
  goal,
  issues,
  pulls,
  boardItems,
  areas,
}) {
  const { monday, sunday } = sprintDates(sprint);
  const closed = closedIn(issues, sprint);
  const active = inProgress(issues, pulls, boardItems);
  const line = (issue) => `#${issue.number} ${issue.title}`;
  return [
    `${sprintTitle(sprint)}: ${formatDay(monday)} to ${formatDay(sunday)}, module Week ${moduleWeek(sprint)}`,
    `Goal: ${goal}`,
    "",
    `Closed this sprint (${closed.length})`,
    ...groupLines(closed, areas, line),
    "",
    `In progress (${active.length})`,
    ...groupLines(active, areas, line),
  ].join("\n");
}

async function readBoardItemsIfAny(github) {
  const board = await findBoard(github);
  if (board) return readBoardItems(github, board);
  github.log(
    "No board is linked yet, so this goes by pull requests and assignees.\n",
  );
  return [];
}

export async function sprintReport(github, { sprint, date }) {
  const today = singaporeDate(new Date());
  const number = sprint ?? sprintForDate(date ?? today);
  if (!number) {
    github.log(`${date ?? today} is outside the sprint calendar.`);
    return null;
  }
  const { goal } = loadSprintGoals().find((item) => item.sprint === number);
  const report = buildReport({
    sprint: number,
    goal,
    issues: await readIssues(github),
    pulls: await readPullRequests(github),
    boardItems: await readBoardItemsIfAny(github),
    areas: areaLabels(loadLabels()),
  });
  github.log(report);
  return report;
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli({
      sprint: { type: "string" },
      date: { type: "string" },
    });
    await sprintReport(new GitHub({ dryRun: true }), {
      sprint: values.sprint ? Number(values.sprint) : undefined,
      date: values.date,
    });
  });
}
