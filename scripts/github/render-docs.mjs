// Renders `docs/agile/backlog.md` and the wiki's sprint calendar from the data.
// Usage: node scripts/github/render-docs.mjs [--dry-run] [--check]
//
// --check exits non-zero if a rendered file is out of date, for CI to use.

import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { loadBacklog, loadLabels, loadSprintGoals } from "./lib/catalogue.mjs";
import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { repoPath } from "./lib/files.mjs";
import { renderBacklog, renderSprintCalendar } from "./lib/render.mjs";

export function renderedFiles() {
  const backlog = loadBacklog();
  return [
    {
      path: "docs/agile/backlog.md",
      text: renderBacklog(backlog, loadLabels()),
    },
    {
      path: "docs/wiki/Sprint-calendar.md",
      text: renderSprintCalendar(loadSprintGoals(), backlog),
    },
  ];
}

function isCurrent({ path, text }) {
  const file = repoPath(path);
  return existsSync(file) && readFileSync(file, "utf8") === text;
}

export function renderDocs({
  dryRun = false,
  check = false,
  log = console.log,
}) {
  const stale = renderedFiles().filter((file) => !isCurrent(file));
  for (const file of stale) {
    if (dryRun || check) log(`would render ${file.path}`);
    else {
      writeFileSync(repoPath(file.path), file.text);
      log(`rendered ${file.path}`);
    }
  }
  log(`render: ${stale.length} file(s) out of date`);
  return stale;
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli({ check: { type: "boolean", default: false } });
    const stale = renderDocs({
      dryRun: values["dry-run"],
      check: values.check,
    });
    if (values.check && stale.length > 0) {
      throw new Error("Run node scripts/github/render-docs.mjs and commit.");
    }
  });
}
