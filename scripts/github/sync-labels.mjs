// Makes the repository's labels match `.github/labels.json`.
// Usage: node scripts/github/sync-labels.mjs [--dry-run] [--prune]
//
// Labels outside the catalogue, such as GitHub's defaults, are only reported.
// --prune deletes them, and that is destructive, so it needs Richie's yes.

import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { loadLabels } from "./lib/catalogue.mjs";
import { GitHub } from "./lib/github.mjs";

const fold = (name) => name.toLowerCase();

function differs(current, label) {
  return (
    current.name !== label.name ||
    fold(current.color) !== fold(label.color) ||
    (current.description ?? "") !== label.description
  );
}

export function planLabels(wanted, existing, { prune = false } = {}) {
  // GitHub treats label names as case-insensitive, so a label differing only
  // in case is the same label and creating it would fail.
  const byName = new Map(existing.map((label) => [fold(label.name), label]));
  const known = new Set(wanted.map((label) => fold(label.name)));
  const actions = [];
  for (const label of wanted) {
    const current = byName.get(fold(label.name));
    if (!current) actions.push({ type: "create", label });
    else if (differs(current, label)) {
      actions.push({ type: "update", from: current.name, label });
    }
  }
  const extras = existing.filter((label) => !known.has(fold(label.name)));
  if (prune) {
    for (const label of extras) actions.push({ type: "delete", label });
  }
  return { actions, extras };
}

export function labelPath(repo, name) {
  return `repos/${repo}/labels/${encodeURIComponent(name)}`;
}

async function apply(github, action) {
  const { type, label, from } = action;
  if (type === "create") {
    await github.write(
      `create label "${label.name}"`,
      "POST",
      `repos/${github.repo}/labels`,
      label,
    );
  } else if (type === "update") {
    await github.write(
      `update label "${from}"`,
      "PATCH",
      labelPath(github.repo, from),
      {
        new_name: label.name,
        color: label.color,
        description: label.description,
      },
    );
  } else {
    await github.write(
      `delete label "${label.name}"`,
      "DELETE",
      labelPath(github.repo, label.name),
    );
  }
}

export async function syncLabels(github, { prune = false } = {}) {
  const existing = await github.getAll(`repos/${github.repo}/labels`);
  const { actions, extras } = planLabels(loadLabels(), existing, { prune });
  for (const action of actions) await apply(github, action);
  if (extras.length > 0 && !prune) {
    const names = extras.map((label) => label.name).join(", ");
    github.log(`labels kept, outside the catalogue: ${names}`);
  }
  github.log(`labels: ${actions.length} change(s)`);
  return actions;
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli({ prune: { type: "boolean", default: false } });
    const github = new GitHub({ dryRun: values["dry-run"] });
    await syncLabels(github, { prune: values.prune });
  });
}
