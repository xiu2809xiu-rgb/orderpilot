// Creates the 18 sprint milestones and keeps their dates and goals current.
// Usage: node scripts/github/sync-milestones.mjs [--dry-run]
//
// Daily notes in a milestone's description are kept on every run.

import { loadSprintGoals } from "./lib/catalogue.mjs";
import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { GitHub } from "./lib/github.mjs";
import { readMilestones } from "./lib/issues.mjs";
import { planMilestones } from "./lib/milestones.mjs";

export async function syncMilestones(github) {
  const actions = planMilestones(
    loadSprintGoals(),
    await readMilestones(github),
  );
  for (const action of actions) {
    if (action.type === "create") {
      await github.write(
        `create milestone "${action.body.title}"`,
        "POST",
        `repos/${github.repo}/milestones`,
        action.body,
      );
    } else {
      const fields = Object.keys(action.patch).join(", ");
      await github.write(
        `update milestone "${action.title}": ${fields}`,
        "PATCH",
        `repos/${github.repo}/milestones/${action.number}`,
        action.patch,
      );
    }
  }
  github.log(`milestones: ${actions.length} change(s)`);
  return actions;
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli();
    await syncMilestones(new GitHub({ dryRun: values["dry-run"] }));
  });
}
