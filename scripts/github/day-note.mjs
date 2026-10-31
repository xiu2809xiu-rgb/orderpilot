// Adds the daily note to the current sprint's milestone.
// Usage: node scripts/github/day-note.mjs [--dry-run] [--date <yyyy-mm-dd>] "<note>"
//
// A note: what merged and what is in progress. Running the same note twice on
// one day adds it once.

import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { GitHub } from "./lib/github.mjs";
import { readMilestones } from "./lib/issues.mjs";
import { appendNote } from "./lib/milestones.mjs";
import {
  singaporeDate,
  sprintForDate,
  sprintTitle,
} from "./lib/sprint-calendar.mjs";

export async function addDayNote(github, { text, date }) {
  const day = date ?? singaporeDate(new Date());
  const sprint = sprintForDate(day);
  if (!sprint) throw new Error(`${day} is outside the sprint calendar.`);
  const title = sprintTitle(sprint);
  const milestones = await readMilestones(github);
  const milestone = milestones.find((item) => item.title === title);
  if (!milestone) {
    throw new Error(
      `"${title}" does not exist. Run sync-milestones.mjs first.`,
    );
  }
  const description = appendNote(milestone.description, day, text);
  if (description === null) {
    github.log(`The note is already on "${title}" for ${day}.`);
    return false;
  }
  await github.write(
    `add the note for ${day} to "${title}"`,
    "PATCH",
    `repos/${github.repo}/milestones/${milestone.number}`,
    { description },
  );
  return true;
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values, positionals } = parseCli({ date: { type: "string" } });
    const text = positionals.join(" ").trim();
    if (!text) throw new Error('Say what happened: day-note.mjs "<note>"');
    const github = new GitHub({ dryRun: values["dry-run"] });
    await addDayNote(github, { text, date: values.date });
  });
}
