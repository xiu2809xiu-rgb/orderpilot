# Area 2, prompt 007: the Management approver on the Spectra design

No story owns this: it is UI polish for the proposal demo, a second pass on the approver after [area2-006](area2-006-ui-pm-approver.md), because pull request 277 (ADR 0054) made Spectra the product's only design and restyled the workflow pages. Azri's prompt is quoted as typed, and the rest is summarised.

## 1. The review

```text
alright lets now work on the final role's UI
```

The third role in the role list is the Management approver. The AI rebuilt the Docker stack from `main` after pull request 277, signed in as the approver, screenshotted every page and the SPR, order, customer, vendor and item pages behind them, and recorded console errors and failed requests (there were none). Most of the first pass survived the restyle: Home opens an SPR for review, My tasks says what each SPR buys, and the SPR page shows when it is due and its history.

## 2. The fixes, in area 2's own files

- The SPR page marked a suggested value with a sparkle, the icon Spark, the AI assistant, wears. The value is worked out from stock by a fixed rule, so the mark now uses a calculator, and a test fails if the sparkle comes back.
- The link back from an order or an SPR said "the task inbox"; the page is called My tasks.
- A reminder about an SPR now says what the SPR would buy, on its own line, as the task row does. The reminder contract gains an optional `spr`, the same summary a task carries, and the task row's line moved to its own file so both lists share it.

One fix is in area 1's order page, because area 2 caused it. Pull request 273 removed the wording for an SPR approval's action when Home stopped approving in one click, and the new order page still asked for it, so the approver's main button showed its key, "needs.actions.APPROVE_SPR". The wording is back as "Review", and the button opens the SPR, as Home's does, rather than the order's steps page.

Each new test was seen failing against code broken on purpose. A scan of every page the three roles reach found no other raw key.

## 3. Left to their owners

Home's "Needs you" rows, the Home timeline's "past its usual time" beside "due in 14 h", the item page's repeated "Qty. on Sales Order" and the menu group for Customers are area 1's; the item and vendor cost the approver cannot see waits for area 4's pull request 272.
