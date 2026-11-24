# Prompt area4-012: #369, the Observability tab's samples

Angelyn's prompts for bug [#369](https://github.com/xiu2809xiu-rgb/orderpilot/issues/369), as written, in the order sent. The issue itself was asked for in the fourth prompt of [area4-011](area4-011-f10-chain-picture.md#4-the-approval) ("The two Observability problems: create a new issue"). The result is in the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#what-the-base-gives-you).

## 1. The task

```text
#374 is merged. First, switch to main, pull, and delete the merged local
branch feat/area4-chain-picture.

Then two small Area 4 issues, one at a time, each on its own branch from
an up-to-date main:

1. #369 (Observability): stop the sample "worker is degraded" status
   from looking like a real alert, and make the traces card say its IDs
   are samples instead of pointing to Grafana. Screen side only; don't
   change Richie's mock file.
2. Then #276 (the four findings on Area 4 pages).

For each one: plan first and wait for my approval, write the failing
test first, break the code on purpose to prove the tests work, take
light and dark screenshots from a Docker build, and add the docs rows.
Commit as you go, and don't push until I say. Same rules as before.
```

## 2. The approval

```text
Approved, with three small changes:
1. Keep the amber "Degraded" chip. The card's note makes it clear.
2. Use plainer wording for the traces card: "Sample requests by route.
   Their trace IDs are made up, so they can't be looked up yet."
3. Put the traceability and usage-log rows in their own commit, flagged
   for Richie, as in earlier PRs. The guide and the prompt file can stay
   in the docs commit. In the PR, mention that Richie's G-1 screenshots
   were retaken.

Go ahead. When everything is green, push, open the PR and send me the
link. Then plan #276.
```
