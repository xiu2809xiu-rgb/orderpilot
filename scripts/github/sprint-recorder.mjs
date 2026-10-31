// Sets the milestone of finished work to the sprint it finished in. The sprint
// recorder workflow runs this when an issue closes or a pull request merges.
// Try it by hand: node scripts/github/sprint-recorder.mjs --dry-run --issue 1
//                 node scripts/github/sprint-recorder.mjs --dry-run --pull 3
//
// Nothing here fails on a date outside the calendar or a missing milestone: the
// milestones exist to record work, and work must never fail because of them.

import { readFileSync } from "node:fs";

import { isMain, parseCli, runMain } from "./lib/cli.mjs";
import { GitHub } from "./lib/github.mjs";
import { readMilestones } from "./lib/issues.mjs";
import { milestoneForInstant, wasFinished } from "./lib/recording.mjs";

const ISSUE_FACTS = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      number state stateReason closedAt
      milestone { number }
      timelineItems(last: 1, itemTypes: [CLOSED_EVENT]) {
        nodes {
          ... on ClosedEvent {
            closer {
              __typename
              ... on PullRequest { number mergedAt milestone { number } }
            }
          }
        }
      }
    }
  }
}`;

const PULL_FACTS = `query($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      number merged mergedAt
      milestone { number }
      closingIssuesReferences(first: 50) {
        nodes { number state stateReason milestone { number } }
      }
    }
  }
}`;

export function targetFromEvent(eventName, payload) {
  if (eventName === "issues" && payload.action === "closed") {
    return { kind: "issue", number: payload.issue.number };
  }
  if (
    eventName === "pull_request_target" &&
    payload.action === "closed" &&
    payload.pull_request.merged
  ) {
    return { kind: "pull", number: payload.pull_request.number };
  }
  return null;
}

const entry = (kind, item) => ({
  kind,
  number: item.number,
  current: item.milestone?.number ?? null,
});

// GitHub's own closing of an issue fires this too, so both events reach here for
// one merge. Going by the merge time in both cases keeps them agreeing, even if
// the two moments fall either side of midnight on a Sunday.
export function planFromIssue(issue) {
  if (issue.state !== "CLOSED" || !wasFinished(issue.stateReason)) return null;
  const closer = issue.timelineItems.nodes[0]?.closer;
  const pull =
    closer?.__typename === "PullRequest" && closer.mergedAt ? closer : null;
  return {
    when: pull?.mergedAt ?? issue.closedAt,
    items: [
      entry("issue", issue),
      ...(pull ? [entry("pull request", pull)] : []),
    ],
  };
}

export function planFromPull(pull) {
  if (!pull.merged) return null;
  const issues = pull.closingIssuesReferences.nodes.filter(
    (issue) => issue.state === "OPEN" || wasFinished(issue.stateReason),
  );
  return {
    when: pull.mergedAt,
    items: [
      entry("pull request", pull),
      ...issues.map((issue) => entry("issue", issue)),
    ],
  };
}

export function updatesFor(plan, milestones) {
  const milestone = milestoneForInstant(plan.when, milestones);
  if (!milestone) return { milestone: null, updates: [] };
  return {
    milestone,
    updates: plan.items.filter((item) => item.current !== milestone.number),
  };
}

async function readPlan(github, target) {
  const variables = {
    owner: github.owner,
    name: github.name,
    number: target.number,
  };
  if (target.kind === "issue") {
    const data = await github.query(ISSUE_FACTS, variables);
    return planFromIssue(data.repository.issue);
  }
  const data = await github.query(PULL_FACTS, variables);
  return planFromPull(data.repository.pullRequest);
}

export async function record(github, target) {
  const plan = await readPlan(github, target);
  if (!plan) {
    github.log(`#${target.number} is not finished work. Nothing to record.`);
    return [];
  }
  const { milestone, updates } = updatesFor(plan, await readMilestones(github));
  if (!milestone) {
    github.log(`${plan.when} has no sprint milestone. Nothing to record.`);
    return [];
  }
  for (const { kind, number } of updates) {
    await github.write(
      `set ${kind} #${number} to "${milestone.title}"`,
      "PATCH",
      `repos/${github.repo}/issues/${number}`,
      { milestone: milestone.number },
    );
  }
  github.log(`recorder: ${updates.length} change(s)`);
  return updates;
}

function targetFromCli(values) {
  if (values.issue) return { kind: "issue", number: Number(values.issue) };
  if (values.pull) return { kind: "pull", number: Number(values.pull) };
  const { GITHUB_EVENT_NAME: eventName, GITHUB_EVENT_PATH: eventPath } =
    process.env;
  if (!eventName || !eventPath) {
    throw new Error("Pass --issue <n> or --pull <n> outside GitHub Actions.");
  }
  return targetFromEvent(
    eventName,
    JSON.parse(readFileSync(eventPath, "utf8")),
  );
}

if (isMain(import.meta.url)) {
  runMain(async () => {
    const { values } = parseCli({
      issue: { type: "string" },
      pull: { type: "string" },
    });
    const github = new GitHub({ dryRun: values["dry-run"] });
    const target = targetFromCli(values);
    if (target) await record(github, target);
    else github.log("This event records nothing.");
  });
}
