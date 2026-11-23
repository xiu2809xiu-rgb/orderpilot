# Prompt area4-009: #268, the matrix's data scope

Angelyn's prompts for bug [#268](https://github.com/xiu2809xiu-rgb/orderpilot/issues/268), as written, in the order sent. The result is in [ADR 0065](../../adr/0065-the-data-scope-stays-off-the-matrix.md) and the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#the-data-scope-off-the-matrix-268).

## 1. The task

```text
#275 is committed on fix/area4-task-amounts and paused until Azri
replies. Leave that branch as it is.

Next, fix bug #268. Read it with gh issue view 268. Create branch
fix/area4-matrix-data-scope from an up-to-date main. Start with a failing
test that reproduces the bug, then fix it. If the fix needs a file outside
Area 4, stop and tell me first.

Plan first: the cause, the files and the tests. Wait for my approval
before coding. Same rules as before: no AI attribution, never push to
main, and ask before any git reset or AGENTS.md section 4 command.
```

## 2. The choice and the go-ahead

```text
Option 1b, please: remove the data scope from the matrix, and make Copy
leave the target's scope as it was. Put the regenerated openapi.json and
client in their own commit, flagged for Richie.

Also:
- ADR numbers keep being taken. Check the next free number on main, every
  branch and every open PR right before you open the PR, and tell me which
  one you used.
- If ADR 0024 isn't Area 4's, flag the amendment for its owner in the PR.
- Yes, retake the matrix screenshots in light and dark from a Docker build
  and run e2e in this session, after the unit tests pass.

Show me the summary and the commits before pushing.
```
