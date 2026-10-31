// Runs every step, in order. Safe to repeat: a second run changes nothing.
// Usage: node scripts/github/setup.mjs [--dry-run]
//
// The order matters. Issues need the labels, and the milestones to back-fill
// into. The board needs the issues. It stops at the first step that fails.

import { checkRuleset } from "./check-ruleset.mjs";
import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { GitHub } from "./lib/github.mjs";
import { publishWiki } from "./publish-wiki.mjs";
import { renderDocs } from "./render-docs.mjs";
import { seedBacklog } from "./seed-backlog.mjs";
import { syncBoard } from "./sync-board.mjs";
import { syncLabels } from "./sync-labels.mjs";
import { syncMilestones } from "./sync-milestones.mjs";

export async function setup({ dryRun }) {
  const stale = renderDocs({ check: true });
  if (stale.length > 0) {
    throw new Error(
      "Run node scripts/github/render-docs.mjs and commit first.",
    );
  }
  const github = new GitHub({ dryRun });
  const step = (name) => github.log(`\n== ${name}`);

  step("labels");
  await syncLabels(github);
  step("sprint calendar");
  await syncMilestones(github);
  step("backlog");
  await seedBacklog(github);
  step("board");
  await syncBoard(github);
  step("wiki");
  await publishWiki({ dryRun });
  step("ruleset mirror");
  await checkRuleset(github);
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli();
    await setup({ dryRun: values["dry-run"] });
  });
}
