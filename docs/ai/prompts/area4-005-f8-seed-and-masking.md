# Prompt area4-005: F-8, the seed and the masking sample

Angelyn's prompts for the second half of story F-8 ([#96](https://github.com/xiu2809xiu-rgb/orderpilot/issues/96)), as written, in the order sent. The first half, the matrix search and the E2E #3 browser test, is in [prompt area4-004](area4-004-f8-governance-polish.md). The result is in [ADR 0053](../../adr/0053-revocations-survive-the-seed-and-the-masking-sample-reads-the-matrix.md) and the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#the-seed-and-the-masking-sample-f-8).

## 1. The brief

```text
Part 1 of F-8 is PR #263. Now do PR B on this branch: criteria 3 and 4 of issue #96, using the decisions already agreed (the small revocation table with ADR 0051, and masking.customerNote as a permission row). Shared files (seeders.ts, permissions.ts, refusal-wording.ts, the migration folder, generated files) go in their own commits, named for Richie. This PR closes #96. Start with the tests, show me them failing, and wait for my OK before editing.
```

## 2. The decisions on the plan

```text
OK on all three: keep PR B clear of #263's files, use ADR 0053, and commit permissions.ts and refusal-wording.ts together.
Two changes:
1. Write "Part of #96" in the PR, not "Closes #96", and say in the description that I'll close #96 once both #263 and this PR are merged.
2. List the "Masking" filter group follow-up in the PR description under follow-ups, so it isn't forgotten.
Go ahead with the planned commits, one step at a time. Run the checks before each commit, and show me the description before anything is pushed.
```
