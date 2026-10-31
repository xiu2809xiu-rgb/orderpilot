// Checks that `.github/rulesets/main.json` still mirrors the live ruleset.
// Usage: node scripts/github/check-ruleset.mjs [--dry-run] [--write]
//
// --write refreshes the file from GitHub. Run it after every change to the
// ruleset, and commit the result. It never writes to GitHub: a ruleset guards
// `main`, so changing one stays a deliberate act by a person.

import { writeFileSync } from "node:fs";

import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { readRepoJson, repoPath } from "./lib/files.mjs";
import { GitHub } from "./lib/github.mjs";

export const RULESET_FILE = ".github/rulesets/main.json";
export const RULESET_NAME = "Protect main";

// Only these fields are accepted back by the rulesets API. The rest of a read,
// such as ids, timestamps and links, describes one particular copy.
export function toRulesetFile(live) {
  const { name, target, enforcement, bypass_actors, conditions, rules } = live;
  return { name, target, enforcement, bypass_actors, conditions, rules };
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])]),
  );
}

export function sameRuleset(left, right) {
  return (
    JSON.stringify(sortKeys(toRulesetFile(left))) ===
    JSON.stringify(sortKeys(toRulesetFile(right)))
  );
}

export async function checkRuleset(github, { write = false } = {}) {
  const rulesets = await github.getAll(`repos/${github.repo}/rulesets`);
  const summary = rulesets.find((item) => item.name === RULESET_NAME);
  if (!summary) throw new Error(`No ruleset called "${RULESET_NAME}".`);
  const others = rulesets.filter((item) => item.name !== RULESET_NAME);
  for (const other of others) {
    github.log(
      `not mirrored: "${other.name}" (id ${other.id}). Removing it is Richie's call.`,
    );
  }

  const live = await github.get(`repos/${github.repo}/rulesets/${summary.id}`);
  const inStep = sameRuleset(live, readRepoJson(RULESET_FILE));
  if (write && !inStep) {
    const text = `${JSON.stringify(toRulesetFile(live), null, 2)}\n`;
    writeFileSync(repoPath(RULESET_FILE), text);
    github.log(`refreshed ${RULESET_FILE}. Commit it.`);
    return true;
  }
  if (!inStep) {
    throw new Error(`${RULESET_FILE} no longer mirrors "${RULESET_NAME}".`);
  }
  github.log(`ruleset: ${RULESET_FILE} mirrors "${RULESET_NAME}"`);
  return false;
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli({ write: { type: "boolean", default: false } });
    await checkRuleset(new GitHub({ dryRun: true }), {
      write: values.write && !values["dry-run"],
    });
  });
}
