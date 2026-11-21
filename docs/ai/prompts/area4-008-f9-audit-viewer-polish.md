# Prompt area4-008: F-9, audit viewer polish

Angelyn's prompts for F-9's first pull request ([#103](https://github.com/xiu2809xiu-rgb/orderpilot/issues/103), criteria 1, 4 and 5), as written, in the order sent. The work paused on 14 Nov for the demo fixes ([area4-006](area4-006-demo-readiness.md)) and resumed on 22 Nov. The result is in [ADR 0059](../../adr/0059-the-audit-filters-offer-what-the-trail-holds.md) and the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#audit-viewer-polish-f-9).

## 1. The task (13 Nov)

```text
You're helping Angelyn, the owner of Area 4 (Financial controls, security and monitoring) in the OrderPilot repository, our project for Problem Statement #11, Spectra Innovations.
Before anything else, read AGENTS.md, CLAUDE.md, docs/team/module-ownership.md and my area guide, and follow AGENTS.md exactly, including its UI rules.
Only edit files in Area 4's paths. Never delete, move or overwrite anyone else's work. Never run the commands in AGENTS.md section 4 without my OK. Don't push, open a pull request or merge unless I ask.
Today's task: issue #103, "F-9: Audit viewer polish". Read it with gh issue view 103.
Split it into two PRs, like F-8. This branch is PR A, "Part of #103", with criteria 1, 4 and 5:
1. The actor filter is a picker of people by name (names only, never emails), served by an endpoint that needs the audit-read permission. The action filter offers the action names that actually exist.
4. A broken chain shows the event it breaks at, with a link to open it and the events around it.
5. A browser test: an auditor filters to refusals, opens one, and sees a masked value with its reason.
For tests of a broken chain, tamper with rows only in the test database. Never add a route or UI that edits audit rows.
Criteria 2 (saved views on the server) and 3 (background chain check with progress) come in PR B later.
First give me your plan: for each criterion, the files you'll change (confirm each is in my area, and mark any shared file), the shared components you'll reuse, the tests, and the screenshots. Wait for my OK before you edit anything.
```

## 2. The decisions (13 Nov)

```text
Decisions:
1. Don't add a masking rule for Spr.amount: auditors need to see amounts, so hiding them would weaken the control. Instead, check whether the browser test can reach a refusal whose audit row already shows a masked value with its reason, e.g. F-5's bank details masked to the last four for the auditor. If that isn't reachable in e2e, use the alternative (open the refusal as the system admin with the reason masked, then as the auditor in full), and say clearly in the PR that this departs from the criterion's wording so I can raise it with Richie. Either way, trigger the refusal with a role that can never pass (e.g. Warehouse), never the approver, so the test can't approve a real SPR.
2. Yes, add the action index, in its own commit.
3. Yes, use governance.spec.ts.
4. Yes, the leftovers fix goes first, in its own commit. Check the usage log's tables render correctly afterwards.
Keep all new routes GET-only and never edit audit rows outside the test database. Start with the tests, show me them failing, then implement one step at a time.
```

## 3. Resuming (22 Nov)

```text
Resume story F-9 (audit viewer polish) on branch feat/area4-audit-viewer-polish.

Context:
- The branch has a work-in-progress commit 02b4da7. Commits 8a1d567 and 59db59f
  must be dropped. Show me the exact commands to do that and wait for my OK.
- Then merge origin/main into the branch and resolve any conflicts.
- Agreed decision: the Auditor still sees SPR amounts (no masking for that role).

Rules (from AGENTS.md):
- Read AGENTS.md and docs/area4 first.
- Plan first. List the acceptance criteria still open, the files you'll change
  and the tests you'll add, then WAIT for my approval before coding.
- Only touch Area 4 files. If a shared file must change, put it in its own
  commit and flag it for Richie's review.
- Synthetic data only. No Co-Authored-By or AI attribution in commits.
  Conventional Commits.
- Never push to main. Ask before any command in AGENTS.md section 4
  (no migrate reset, no docker compose down -v, no git reset --hard).
- When done, run lint, typecheck and unit tests, and update the area guide,
  the AI usage log and traceability.
```

## 4. Dropping the two commits and merging main (22 Nov)

```text
I've committed the approver-group merge myself and pushed it to PR #327.
The working folder is clean now (check with git status first).

OK to go ahead in this folder, not a second one:
- step 1 as written (backup branch)
- in place of step 2: git switch --detach 50c61b58
- steps 3, 4 and 5 as written
Then pnpm install --frozen-lockfile, merge origin/main, resolve the two
conflicts keeping both sides, and show me the result before committing.
Then typecheck, then bring me the plan. No coding until I approve it.
```

## 5. Between the steps: #327's ADR number (22 Nov)

This one is for #327, not F-9. It renumbered the approver group's ADR, which main's 0055 had overtaken.

```text
On feat/area4-approver-group (PR #327): main already has ADR 0055.
Rename docs/adr/0055-the-approver-group-replaces-the-approval-chain.md
to 0056, update every link and mention of it (grep for "0055-the-approver"),
run lint and the docs checks, and commit as
"docs(adr): renumber the approver group ADR to 0056". Show me the diff before pushing.
```

## 6. The answers and the go-ahead (22 Nov)

```text
two commits and here is the reply to ur previous question:
1. Yes, commit the merge with the default message.
2. Criterion 5: option (a). Keep the test, and in the PR say that ADR 0058
   step 4 flips the masked side and step 5 drops the auditor, and ask Richie
   to restate the criterion for the new roles.
3. Yes: #327 takes 0056 (I'll fix that on #327), F-9 takes 0059. Check 0059
   is still free on main before you open the PR.
4. "Part of #103" is fine.

The plan is approved as written, including the deliberate breaks and
signing in as the system admin in the new tests. Go ahead and code it.
Do the Docker build and end-to-end run in this session too, after the
unit tests pass, so the PR has screenshots and a green e2e. Then show me
the summary and the commits before pushing.
```
