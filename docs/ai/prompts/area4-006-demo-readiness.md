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
