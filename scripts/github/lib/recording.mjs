import { sprintForInstant, sprintTitle } from "./sprint-calendar.mjs";

// "Not planned" and "duplicate" close an issue without finishing it, and the
// milestones record finished work.
const UNFINISHED = new Set(["NOT_PLANNED", "DUPLICATE"]);

export function wasFinished(stateReason) {
  return !UNFINISHED.has(stateReason);
}

export function milestoneForInstant(instant, milestones) {
  const sprint = sprintForInstant(instant);
  if (!sprint) return null;
  const title = sprintTitle(sprint);
  return milestones.find((milestone) => milestone.title === title) ?? null;
}
