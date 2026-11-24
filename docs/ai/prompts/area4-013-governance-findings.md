# Prompt area4-013: #276, four findings on area 4's pages

Angelyn's prompts for bug [#276](https://github.com/xiu2809xiu-rgb/orderpilot/issues/276), as written, in the order sent. The task itself, "Then #276 (the four findings on Area 4 pages)", is quoted in [prompt area4-012](area4-012-observability-samples.md#1-the-task). The result is in the [area 4 guide](../../team/area-4-controls-security-and-monitoring.md#the-governance-pages-findings-276).

## 1. Plan it next

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

## 2. The approval

```text
#276 plan approved. On your two questions:
1. Yes, include the audited user.disable.refused row in #276, in its own
   commit flagged for Richie, with the API test. Every refusal should be
   recorded. Also search for any other refusals (409s or similar) that
   skip the audit, and list them for me. Don't fix those here.
2. Yes, create the issue for Richie's checkPage helper. Describe what it
   misses and how your #276 test measures the panel instead. Don't
   change his helper.

As before: when everything is green, push, open the PR and send me the
link.
```
