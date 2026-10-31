import { readRepoJson } from "./files.mjs";

const AREA_PREFIX = "area: ";

export function loadLabels() {
  return readRepoJson(".github/labels.json");
}

export function loadBacklog() {
  return readRepoJson("scripts/github/data/backlog.json");
}

export function loadSprintGoals() {
  return readRepoJson("scripts/github/data/sprints.json");
}

export function areaLabels(labels) {
  return labels
    .map((label) => label.name)
    .filter((name) => name.startsWith(AREA_PREFIX));
}

// The board's Area options are the area labels without their prefix, so the
// board and the labels cannot drift apart.
export function areaOption(label) {
  return label.slice(AREA_PREFIX.length);
}

export function reqLabel(labels, req) {
  const found = labels.find((label) => label.name.startsWith(`req: ${req} `));
  if (!found) throw new Error(`No label for requirement ${req}`);
  return found.name;
}
