// Seeds the backlog from `data/backlog.json`: one issue per epic and story, each
// story a sub-issue of its epic. Also back-fills closed work into the milestone
// of the week it finished, for anything closed before the recorder could.
// Usage: node scripts/github/seed-backlog.mjs [--dry-run]
//
// Issues are matched by the key in their title, so #1 and #2 are adopted and a
// renamed story keeps its issue. A closed issue is never reopened, and its body
// is left as it was finished.

import {
  epicKey,
  epicLabels,
  epicTitle,
  keyFromTitle,
  mergeBody,
  mergeLabels,
  renderEpicBlock,
  renderStoryBlock,
  sameBody,
  sameSet,
  storyLabels,
  storyTitle,
} from "./lib/backlog.mjs";
import { loadBacklog, loadLabels } from "./lib/catalogue.mjs";
import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { GitHub } from "./lib/github.mjs";
import { readIssues, readMilestones, readPullRequests } from "./lib/issues.mjs";
import { milestoneForInstant, wasFinished } from "./lib/recording.mjs";
import { allSprints, sprintTitle } from "./lib/sprint-calendar.mjs";

const ADD_SUB_ISSUE = `mutation($input: AddSubIssueInput!) {
  addSubIssue(input: $input) { issue { number } subIssue { number } }
}`;

export function wantedItems(backlog, labels) {
  const epics = backlog.epics.map((epic) => ({
    key: epicKey(epic),
    title: epicTitle(epic),
    labels: epicLabels(backlog, epic, labels),
    block: renderEpicBlock(epic, backlog, labels),
    parentKey: null,
  }));
  const stories = backlog.stories.map((story) => ({
    key: story.key,
    title: storyTitle(story),
    labels: storyLabels(story, labels),
    block: renderStoryBlock(story, backlog, labels),
    parentKey: `Epic ${story.epic}`,
  }));
  return [...epics, ...stories];
}

// If someone creates a second issue for a key by hand, the oldest one is the
// story. The newer one is reported, never closed or merged by a script.
export function matchIssues(issues) {
  const byKey = new Map();
  const duplicates = [];
  const oldestFirst = [...issues].sort((a, b) => a.number - b.number);
  for (const issue of oldestFirst) {
    const key = keyFromTitle(issue.title);
    if (!key) continue;
    if (byKey.has(key)) duplicates.push({ key, number: issue.number });
    else byKey.set(key, issue);
  }
  return { byKey, duplicates };
}

export function closedMilestone(item, instant, milestones) {
  if (item.milestone || !instant) return null;
  return milestoneForInstant(instant, milestones);
}

export function planIssue(wanted, issue, milestones) {
  if (!issue) {
    return {
      type: "create",
      key: wanted.key,
      body: {
        title: wanted.title,
        body: `${wanted.block}\n`,
        labels: wanted.labels,
      },
    };
  }
  const patch = {};
  if (issue.title !== wanted.title) patch.title = wanted.title;
  const labels = mergeLabels(issue.labels, wanted.labels);
  if (!sameSet(labels, issue.labels)) patch.labels = labels;
  if (issue.state === "OPEN") {
    const body = mergeBody(issue.body, wanted.block);
    if (!sameBody(body, issue.body)) patch.body = body;
  } else if (wasFinished(issue.stateReason)) {
    const milestone = closedMilestone(issue, issue.closedAt, milestones);
    if (milestone) patch.milestone = milestone.number;
  }
  if (Object.keys(patch).length === 0) return null;
  return { type: "update", key: wanted.key, number: issue.number, patch };
}

export function planLink(wanted, byKey) {
  if (!wanted.parentKey) return null;
  const child = byKey.get(wanted.key);
  const parent = byKey.get(wanted.parentKey);
  if (child && parent && child.parent === parent.number) return null;
  return { child, parent, key: wanted.key, parentKey: wanted.parentKey };
}

// Work merged before the recorder existed has no milestone. That includes P-2's
// own pull request: the recorder runs on it, but the milestones do not exist
// until after the merge.
export function planPullBackfill(pulls, milestones) {
  return pulls.flatMap((pull) => {
    const milestone = closedMilestone(pull, pull.mergedAt, milestones);
    return milestone ? [{ number: pull.number, milestone }] : [];
  });
}

// A dry run may come before the milestones exist. Planning against the ones
// about to be made is what lets it show the back-fill a real run will do.
export function withPlannedMilestones(milestones) {
  const titles = new Set(milestones.map((milestone) => milestone.title));
  const planned = allSprints()
    .map(sprintTitle)
    .filter((title) => !titles.has(title))
    .map((title) => ({ number: null, title }));
  return [...milestones, ...planned];
}

function missingLabels(wanted, repoLabels) {
  const present = new Set(repoLabels.map((label) => label.name.toLowerCase()));
  const needed = wanted.flatMap((item) => item.labels);
  return [...new Set(needed)].filter(
    (name) => !present.has(name.toLowerCase()),
  );
}

async function applyIssue(github, action, byKey) {
  if (action.type === "create") {
    const created = await github.write(
      `create issue "${action.body.title}"`,
      "POST",
      `repos/${github.repo}/issues`,
      action.body,
    );
    if (created) {
      byKey.set(action.key, {
        id: created.node_id,
        number: created.number,
        parent: null,
      });
    }
    return;
  }
  const fields = Object.keys(action.patch).join(", ");
  await github.write(
    `update issue #${action.number} (${action.key}): ${fields}`,
    "PATCH",
    `repos/${github.repo}/issues/${action.number}`,
    action.patch,
  );
}

async function applyLink(github, link) {
  const { child, parent, key, parentKey } = link;
  if (!child || !parent) {
    github.log(`would link ${key} under ${parentKey}`);
    return;
  }
  await github.mutate(
    `link #${child.number} (${key}) under #${parent.number} (${parentKey})`,
    ADD_SUB_ISSUE,
    {
      input: {
        issueId: parent.id,
        subIssueId: child.id,
        replaceParent: child.parent !== null,
      },
    },
  );
}

export async function seedBacklog(github) {
  const backlog = loadBacklog();
  const labels = loadLabels();
  const wanted = wantedItems(backlog, labels);
  const [issues, stored, pulls, repoLabels] = [
    await readIssues(github),
    await readMilestones(github),
    await readPullRequests(github),
    await github.getAll(`repos/${github.repo}/labels`),
  ];
  const milestones = github.dryRun ? withPlannedMilestones(stored) : stored;

  const absent = missingLabels(wanted, repoLabels);
  if (absent.length > 0) {
    const message = `${absent.length} label(s) are not on the repository yet. Run sync-labels.mjs first.`;
    if (!github.dryRun) throw new Error(message);
    github.log(message);
  }

  const { byKey, duplicates } = matchIssues(issues);
  for (const { key, number } of duplicates) {
    github.log(`left alone: #${number} repeats the key ${key}`);
  }

  const actions = wanted.flatMap((item) => {
    const action = planIssue(item, byKey.get(item.key), milestones);
    return action ? [action] : [];
  });
  for (const action of actions) await applyIssue(github, action, byKey);

  const links = wanted.flatMap((item) => {
    const link = planLink(item, byKey);
    return link ? [link] : [];
  });
  for (const link of links) await applyLink(github, link);

  const backfills = planPullBackfill(pulls, milestones);
  for (const { number, milestone } of backfills) {
    await github.write(
      `set pull request #${number} to "${milestone.title}"`,
      "PATCH",
      `repos/${github.repo}/issues/${number}`,
      { milestone: milestone.number },
    );
  }

  const created = actions.filter((action) => action.type === "create").length;
  const updated = actions.length - created;
  github.log(
    `backlog: ${created} to create, ${updated} to update, ${links.length} link(s), ${backfills.length} pull request(s) to back-fill`,
  );
  return { actions, links, backfills };
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli();
    await seedBacklog(new GitHub({ dryRun: values["dry-run"] }));
  });
}
