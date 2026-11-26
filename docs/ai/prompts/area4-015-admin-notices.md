# Prompt area4-015: the approvers are told what the administrator gives itself

Angelyn's prompts for issue [#383](https://github.com/xiu2809xiu-rgb/orderpilot/issues/383), as written, in the order sent. The result is in the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#the-administrators-own-role-383) and [ADR 0067](../../adr/0067-the-approvers-are-told-what-the-administrator-gives-itself.md).

## 1. The choice, and the plan

The issue came from her review of #363, which counted what the administrator could give its own role alone. It offered two ways: a second person approves such a grant, or at least the approvers are told.

```text
Thanks. For #383: go with notifying the approvers, plus the two locks.
Plan it, then wait for my approval before starting. Nothing else
tonight.
```

## 2. The approval

```text
Plan approved, with these additions:
1. The new lock sentence is fine. Flag the CLAUDE.md change for Richie.
2. If the clean-up migration deletes any admin rows, record an audit row
   for each, as I asked of #348.
3. Check whether an admin can give their own account another role on
   the Users tab. If so, refuse it or write the same notice, and test it.
4. Check whether the admin could hide the notices by revoking
   approvals.decide from the approvers. If so, write a notice for that
   change too, or lock approvals.decide on for the approver role. Tell
   me which you'd choose and why.
Start after #379 merges.
```

What the four additions became:

1. The CLAUDE.md change is a request to Richie in the pull request. CLAUDE.md itself is not edited.
2. A migration cannot write rows through the audit writer, so the seed does the clean-up instead, with one audit row per repair. On the demo data there is nothing to repair.
3. No route changes an account's role, so there was nothing to refuse. A test pins that.
4. `approvals.decide` is locked on for the approver role. A notice for that change would go to the people who had just lost the right to read it, and no SPR could be decided until someone gave it back.

## 3. After the pull request

```text
Thanks, good work.
1. Yes, delete fix/area4-admin-self-grant.
2. Fix the silent "Mark as read" failure in this PR: show a toast with
   the server's reason and trace ID, as #276 does. Leave the loading
   line as it is, since it matches the reminders, and note it in the PR
   for Richie's bell.
3. Check whether #379 is merged. If #386 contains #379's commits, say
   in the PR that it must merge after #379.
4. Tell me when the checks are green.
```

#379 had merged on 24 Nov, before the branch was cut, so #386 holds none of its commits. Rerunning the end-to-end tests against a stack that had unread notices found that the bell's name left out the number on its badge, which axe refuses (label in name), and that was fixed too.

#386 had already been merged, so the toast and the bell's name could not go into it. Asked how they should reach main, she chose a new issue and pull request: [#400](https://github.com/xiu2809xiu-rgb/orderpilot/issues/400).
