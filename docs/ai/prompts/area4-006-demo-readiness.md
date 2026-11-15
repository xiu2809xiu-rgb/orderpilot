# Prompt area4-006: Demo readiness for the Week 5 proposal

Angelyn's prompts for the demo-readiness fixes, as written, in the order sent. They paused F-9 ([#103](https://github.com/xiu2809xiu-rgb/orderpilot/issues/103)), whose prompt comes after this one. The result is in the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#ready-for-the-week-5-demo).

## 1. The change of focus

```text
Change of focus: the Week 5 proposal presentation includes a live UI demo, marked on: every major flow clickable end to end; loading, empty, error and permission-denied states; consistent styling; and a first-time user reaching key screens unaided. Demo-readiness now comes before F-9.

1. First, tell me where F-9 stands: what's done, committed, and half-done. Don't throw anything away. Commit finished work in small commits; leave unfinished work uncommitted and tell me what it is. Pause F-9 after that.

2. In a Docker build of main plus this branch, walk through the demo as a first-time user would, and check every Area 4 screen and every place Area 4's controls appear in other areas' screens:
   a. Sign in as System Admin: the permission matrix (search, filter, turn a permission off, Undo), the masking tab, the audit log, and monitoring.
   b. Sign in as each other role in turn: does each land on a sensible home page, and does each get a clear permission-denied page (with the reason) for screens it can't use?
   c. As Warehouse, open an order: are prices masked with their reason?
   d. As Warehouse, call the SPR approve route: is the refusal shown with a trace ID? Then as Auditor, can you find and open that refusal in the audit log?
   List every gap: dead ends, missing loading/empty/error/permission-denied states, inconsistent styling, unclear labels, or anything a first-time user would get stuck on. Say for each one whether it's in Area 4's files or another area's. Show me the list before fixing anything.

3. After I pick which gaps to fix, fix only those in Area 4's files, and list the others for me to raise with their owners. Take light and dark screenshots of each Area 4 screen afterwards, for my slides.

4. Only if there's time after that, go back to F-9's UI parts (the actor and action pickers, and the broken-chain links).

Don't push, open a PR or merge unless I ask.
```

## 2. The gaps to fix

```text
Fix A1, A2, A4, A5, A6, A7, A8, A9 and A10 on a new branch fix/area4-demo-readiness from main. A2's shared repository change goes in its own commit for Richie. Leave A3 and A11 for F-9.
Before switching: don't stash. Commit the uncommitted F-9 tests on feat/area4-audit-viewer-polish as one commit, "test(audit): F-9 UI tests, work in progress", and don't push that branch.
For D2: no code change; I'll start the monitoring demo on Observability.
For D1: I've asked Azri to update his mock text; my #252 will remove the limits and stand-in from the sample chain.
After the fixes, run the checks and redo the walkthrough. In step (c), use the orders list for the masked price. Take light and dark screenshots of each Area 4 screen. Show me the results before pushing.
```

## 3. The issue and the pull request

```text
Before pushing:
1. Draft an issue for this work: type task, area 4, priority must, M2 and M4, current sprint, titled "Area 4 demo readiness: audit, governance and monitoring fixes". List A1, A2 and A4–A10 as its checklist. Show me it before creating it.
2. Cherry-pick 8a1d567 (the #266 leftovers fix) onto this branch as its first change, and note in the F-9 branch's plan that it will drop that commit when it resumes.
3. Draft the PR description: it closes the new issue, names the shared commit f4b1598 for Richie, lists the expected conflicts with F-9, and includes the labels area 4, priority must, type task, M2, M4.
Show me both drafts. Then create the issue, push and open the PR with the labels.
```

## 4. Waiting for Azri

```text
Wait for Azri's answer before changing anything. If he agrees: in #272, adopt from #270 the Observability default for monitoring, the shorter record IDs with copy, and "More filters", but keep the action code visible and the trace ID search easy to find. Credit Azri in the PR description. Keep the post on #103 for the F-9 note too, so it's not only in your memory.
```

## 5. Azri agreed

```text
Azri agreed: #270 will keep only his Home cards and the SPR refusal's trace ID, and drop all Area 4 files. Update #272:
1. Monitoring opens on Observability by default, and the tab stays in the address bar. Check the AI usage tile can link to /monitoring?tab=aiUsage.
2. The audit table: shorter record IDs with copy, and a "More filters" fold. Keep the action code visible and the trace ID search easy to find.
3. masking.ts: let the approver see item cost, because the SPR they decide already shows it. Add a test, update the masking tab's text if it lists who sees cost, and record the reason in my area guide.
4. AnalyticsSettingsCard.tsx: show the chosen setting as selected, with a test.
Each as its own commit, tested first. Update the PR description: credit Azri for ideas 1 and 2, and note the masking change. Then rerun the checks and the walkthrough, retake the screenshots that changed, and show me before pushing.
```

## 6. Item 3 dropped

Item 3 would have changed one assertion in area 1's master-data test, so it was first put to Angelyn, who chose to ask Richie, and then dropped:

```text
actually can we reverse? i want to go with this option. Drop item 3 from #272: it would expose costs across area 1's screens, which is wider than the reason. Leave masking.ts and area 1's test unchanged. Remove the masking note from the PR description. Then run the checks, the walkthrough and the screenshots for items 1, 2 and 4, and show me before pushing.
```
