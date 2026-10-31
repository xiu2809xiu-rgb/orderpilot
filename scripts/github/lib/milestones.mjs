import {
  formatDay,
  moduleWeek,
  sameDueDate,
  sprintDates,
  sprintDueOn,
  sprintTitle,
} from "./sprint-calendar.mjs";

export const NOTES_HEADING = "### Daily notes";

const NOTES_HELP =
  "At the end of each day you work, add a note: what merged and what is in progress. Use `node scripts/github/day-note.mjs`.";

export function sprintNumberFromTitle(title) {
  const match = title.match(/^Sprint (\d+)\b/);
  return match ? Number(match[1]) : null;
}

function renderHead(sprint, goal) {
  const { monday, sunday } = sprintDates(sprint);
  return [
    `**Dates:** ${formatDay(monday)} to ${formatDay(sunday)} (module Week ${moduleWeek(sprint)}), due Sunday 23:59 Singapore time.`,
    "",
    `**Goal:** ${goal}`,
    "",
    NOTES_HEADING,
    "",
    NOTES_HELP,
  ].join("\n");
}

const unixLines = (text) => (text ?? "").replace(/\r\n/g, "\n");

// Text with no notes heading was written by a person before the script got to
// it, so it counts as notes too rather than being overwritten.
function notesOf(description) {
  const text = unixLines(description);
  const heading = text.indexOf(NOTES_HEADING);
  if (heading === -1) return text.trim();
  const rest = text.slice(heading + NOTES_HEADING.length);
  return rest.replace(NOTES_HELP, "").trim();
}

// The daily notes live in the description this script rewrites, so they are
// carried across every rewrite. Losing them would lose the sprint's record.
export function renderDescription(sprint, goal, existing) {
  const notes = notesOf(existing);
  const head = renderHead(sprint, goal);
  return notes ? `${head}\n\n${notes}` : head;
}

export function wantedMilestone(sprint, goal, existing) {
  return {
    title: sprintTitle(sprint),
    description: renderDescription(sprint, goal, existing?.description),
    due_on: sprintDueOn(sprint),
  };
}

export function milestonePatch(sprint, goal, existing) {
  const wanted = wantedMilestone(sprint, goal, existing);
  const patch = {};
  if (existing.title !== wanted.title) patch.title = wanted.title;
  if (unixLines(existing.description).trimEnd() !== wanted.description) {
    patch.description = wanted.description;
  }
  if (!sameDueDate(existing.due_on, sprint)) patch.due_on = wanted.due_on;
  return patch;
}

export function planMilestones(goals, existing) {
  const bySprint = new Map();
  for (const milestone of existing) {
    const sprint = sprintNumberFromTitle(milestone.title);
    if (sprint && !bySprint.has(sprint)) bySprint.set(sprint, milestone);
  }
  const actions = [];
  for (const { sprint, goal } of goals) {
    const current = bySprint.get(sprint);
    if (!current) {
      actions.push({ type: "create", body: wantedMilestone(sprint, goal) });
      continue;
    }
    const patch = milestonePatch(sprint, goal, current);
    if (Object.keys(patch).length > 0) {
      actions.push({
        type: "update",
        number: current.number,
        title: current.title,
        patch,
      });
    }
  }
  return actions;
}

export function appendNote(description, date, text) {
  const line = `- ${date}: ${text}`;
  const body = unixLines(description).trimEnd();
  const notes = notesOf(body);
  if (notes.split("\n").includes(line)) return null;
  return `${body}${notes ? "\n" : "\n\n"}${line}`;
}
