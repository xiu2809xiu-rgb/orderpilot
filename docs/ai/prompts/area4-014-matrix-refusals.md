# Prompt area4-014: the matrix's own refusals, audited

Angelyn's prompts for area 4's part of issue [#378](https://github.com/xiu2809xiu-rgb/orderpilot/issues/378), as written, in the order sent. The result is in the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#finding-and-undoing-on-the-matrix-f-8).

## 1. The issue, and the plan

```text
Thanks. Answers:
1. Leave users.read granted for the system admin in my local database.
2. Yes, delete fix/area4-governance-findings with git branch -D.
3. Don't assign #376. Give it the right area label, and I'll mention it
   to Richie.

About the refusals that skip the audit: draft one issue (show me before
creating it) that lists them by owner and splits them into two groups:
- business-rule refusals that should be audited (for example a locked
  matrix cell, copying a role onto itself, deciding an SPR that's
  already decided, changing an order that isn't a draft);
- technical conflicts that probably shouldn't be (stale versions,
  idempotency keys).
Suggest one shared way to audit refusals by default, so each area
doesn't have to remember.

Then, separately, plan a small Area 4 PR for our own two gaps: the
matrix-rules 409s and the bank hold's 409. Wait for my approval before
starting.
```

## 2. The approval

```text
1. The refusals issue: create it as drafted. For the one open case,
   keep "Someone else moved this order first" audited for now, and list
   it in the issue as a question for Azri. Don't assign it yet; I'll
   raise the shared mechanism with Richie and Azri first.

2. Before the PR, a quick read-only check: read ADR 0058 on main and
   tell me, for each step, the issue number, who it's assigned to, and
   whether it's done, in progress or not started. Which steps are Area
   4's? Does the Auditor still exist today, in the matrix defaults and
   on the sign-in page?

3. Then the Area 4 audit PR: approved as planned. On the bank hold,
   audit only the "no longer open" case, not the race; the other
   person's successful step is already audited. When everything is
   green, push, open the PR and send me the link.
```

The bank hold's "no longer open" case turned out to be audited already, by the policy, so the pull request changes the matrix only.
