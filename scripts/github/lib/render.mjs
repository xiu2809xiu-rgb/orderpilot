import {
  epicKey,
  epicTitle,
  reqNames,
  storiesOf,
  storyFacts,
} from "./backlog.mjs";
import {
  allSprints,
  formatDay,
  moduleWeek,
  sprintDates,
  sprintDueOn,
  sprintTitle,
} from "./sprint-calendar.mjs";

const PRIORITIES = ["must", "should", "could"];

// Padded the way Prettier pads a table, so that P-5's format check passes on
// these files without anyone having to reformat what a script wrote.
export function markdownTable(headers, rows) {
  const widths = headers.map((header, column) =>
    Math.max(
      3,
      header.length,
      ...rows.map((row) => String(row[column]).length),
    ),
  );
  const line = (cells) =>
    `| ${cells.map((cell, column) => String(cell).padEnd(widths[column])).join(" | ")} |`;
  const rule = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`;
  return [line(headers), rule, ...rows.map(line)].join("\n");
}

function epicSummaryTable(backlog) {
  const rows = backlog.epics.map((epic) => {
    const stories = storiesOf(backlog, epic);
    const points = stories.reduce((sum, story) => sum + story.estimate, 0);
    return [
      epicKey(epic),
      epic.title,
      `\`${epic.area}\``,
      stories.length,
      points,
    ];
  });
  return markdownTable(["Epic", "Title", "Area", "Stories", "Points"], rows);
}

function pullOrderTable(backlog, labels) {
  const ordered = PRIORITIES.flatMap((priority) =>
    backlog.stories.filter((story) => story.priority === priority),
  );
  const rows = ordered.map((story) => [
    story.key,
    story.title,
    story.priority,
    story.estimate,
    `\`${story.area}\``,
    reqNames(story.reqs, labels),
  ]);
  return markdownTable(
    ["Story", "Title", "Priority", "Points", "Area", "Requirements"],
    rows,
  );
}

function renderStory(story, backlog, labels) {
  const facts = storyFacts(story, backlog, labels)
    .filter(([name]) => name !== "Epic")
    .map(([name, value]) => `- **${name}:** ${value}`);
  const criteria = story.acceptance.map((line) => `- ${line}`);
  return [
    `### ${story.key}: ${story.title}`,
    "",
    story.summary,
    "",
    ...facts,
    "",
    "Acceptance criteria:",
    "",
    ...criteria,
  ].join("\n");
}

function renderEpic(epic, backlog, labels) {
  const stories = storiesOf(backlog, epic).map((story) =>
    renderStory(story, backlog, labels),
  );
  return [
    `## ${epicTitle(epic)}`,
    "",
    epic.summary,
    "",
    ...stories.flatMap((text) => [text, ""]),
  ]
    .join("\n")
    .trimEnd();
}

export function renderBacklog(backlog, labels) {
  const count = backlog.stories.length;
  return [
    "# Backlog",
    "",
    "Rendered from [`scripts/github/data/backlog.json`](../../scripts/github/data/backlog.json) by `node scripts/github/render-docs.mjs`. Change the data, not this file. The same data seeds the issues. The board shows where each story stands.",
    "",
    `There are ${backlog.epics.length} epics and ${count} stories. Estimates are story points: a first guess, for the team to change at planning.`,
    "",
    "## Epics",
    "",
    epicSummaryTable(backlog),
    "",
    "## In pull order",
    "",
    "Whoever is free pulls the next ready story from the top: Must, then Should, then Could, then continuous work. During the base, work through the stories in order, without waiting between them.",
    "",
    pullOrderTable(backlog, labels),
    "",
    ...backlog.epics.flatMap((epic) => [renderEpic(epic, backlog, labels), ""]),
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}

function storiesPlannedFor(backlog, sprint) {
  return backlog.stories
    .filter((story) => story.sprints?.includes(sprint))
    .map((story) => story.key)
    .join(", ");
}

export function renderSprintCalendar(goals, backlog) {
  const rows = allSprints().map((sprint) => {
    const { monday, sunday } = sprintDates(sprint);
    const { goal } = goals.find((item) => item.sprint === sprint);
    return [
      sprintTitle(sprint),
      moduleWeek(sprint),
      formatDay(monday),
      formatDay(sunday),
      storiesPlannedFor(backlog, sprint) || "-",
      goal,
    ];
  });
  return [
    "# Sprint calendar",
    "",
    "Rendered from [`scripts/github/data/sprints.json`](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/scripts/github/data/sprints.json) by `node scripts/github/render-docs.mjs`. Change the data, not this page.",
    "",
    "One sprint is one week, Monday to Sunday. Sprint _n_ is module Week _n_ + 1. Each sprint is a milestone, due Sunday 23:59 Singapore time. Sprints are a rhythm, not a limit: work never waits for a sprint.",
    "",
    markdownTable(
      ["Sprint", "Week", "Monday", "Sunday", "Planned stories", "Goal"],
      rows,
    ),
    "",
    "## How the calendar is used",
    "",
    "- **A story goes into the milestone of the week it finished.** The sprint recorder does this when an issue closes or its pull request merges, using the date in Singapore.",
    '- **At the end of each day you work,** add a short note to the current milestone: what merged and what is in progress. `node scripts/github/day-note.mjs "Merged P-3. P-4 in progress."` adds it for you.',
    "- **For the end-of-day update and the sprint review,** `node scripts/github/sprint-report.mjs` prints what closed this sprint and what is in progress, by area.",
    "",
    "## Assessments",
    "",
    markdownTable(
      ["Sprint", "Week", "Assessment", "Weight", "Release tag"],
      [
        [sprintTitle(4), 5, "Proposal", "25%", "`v0.1-proposal`"],
        [sprintTitle(6), 7, "Mock job interview", "15%, individual", "None"],
        [
          sprintTitle(12),
          13,
          "Technical review",
          "25%",
          "`v0.2-technical-review`",
        ],
        [sprintTitle(17), 18, "Final", "35%", "`v1.0-final`"],
      ],
    ),
    "",
    `The first milestone is due ${sprintDueOn(1).slice(0, 10)} and the last ${sprintDueOn(allSprints().length).slice(0, 10)}. Each tag follows a feature freeze.`,
    "",
  ].join("\n");
}
