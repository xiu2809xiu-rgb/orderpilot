# Prompt area4-004: F-8, governance base polish

Angelyn's prompts for story F-8 ([#96](https://github.com/xiu2809xiu-rgb/orderpilot/issues/96)), as written, in the order sent. The second came after the AI tool's plan, and nothing was edited before it. The result is in the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#finding-and-undoing-on-the-matrix-f-8).

## 1. The brief

```text
You're helping Angelyn, the owner of Area 4 (Financial controls, security and monitoring) in the OrderPilot repository, our project for Problem Statement #11, Spectra Innovations.
Before anything else, read AGENTS.md, CLAUDE.md, docs/team/module-ownership.md and my area guide, and follow AGENTS.md exactly, including its UI rules.
Only edit files in Area 4's paths. Never delete, move or overwrite anyone else's work. Never run the commands in AGENTS.md section 4 without my OK. Don't push, open a pull request or merge unless I ask.
Today's task: issue #96, "F-8: Governance base polish". Read it with gh issue view 96, and read ADR 0012 point 12 and ADR 0024 point 1.
The four acceptance criteria:
1. The permission matrix gets a search box, a filter by role or permission group, and an undo for a change, from the page.
2. A browser test for E2E #3: a script calls an action endpoint without the right, gets the error envelope with a trace ID, and the refusal shows in the audit viewer.
3. The seed no longer re-adds a permission the owner revoked on purpose, with a test.
4. The masking sample reads its rule from the matrix, so a rule can be shown or hidden for a role without a code change.
F-5 isn't merged yet, so don't build on its code in this branch.
First give me your plan: for each criterion, the files you'll change (confirm each is in my area, and mark any shared file such as the seed or apps/e2e), the shared components you'll reuse, and the tests. Wait for my OK before you edit anything.
```

## 2. The decisions on the plan

```text
Answers:
1. Yes, merge --ff-only origin/main first.
2. Keep the existing Undo, run it through the same save so a refusal shows its trace ID, and make sure an undo is audited as its own change. Copy-role: no Undo, but add a confirm dialog that says it can't be undone.
3. Yes, the small table. Record the "revoked before this story returns once" limit in the ADR.
4. Yes, the permission row.
5. Yes, change refusals.ts, in its own commit, named in the PR for Richie.
Split this into two PRs:
- PR A on this branch: criteria 1 and 2 (search, filters, undo; the E2E #3 browser test). Say "Part of #96".
- PR B on a new branch after A is up: criteria 3 and 4. It closes #96.
Leave the three E2E #3 it.todos for now.
Start PR A with the tests, show me them failing, then implement one step at a time.
```
