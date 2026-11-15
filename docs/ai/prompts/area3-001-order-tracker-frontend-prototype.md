# Prompt area3-001: the order tracker frontend prototype

Iok Teck's prompts for the order tracker frontend prototype, on branch
`feat/area3-order-tracker-frontend-prototype`, as written, in the order sent
across the session. Each came after the AI's plan, diff or test report.

## 1. Lifecycle stage tabs

```text
Add Top Lifecycle Stage Tabs: Insert filter tabs above the table, All (120),
Draft, Pending Approval, Processing, Shipped, and Completed, so staff can
group orders by stage instantly instead of scanning one flat list.
```

Read the tracker's existing screens, params and mock status codes, grouped
the twelve sample status codes into five lifecycle stages (a UI-only
grouping until area 2's state machine reports a real stage), and added the
tab row with a count per stage, reusing the `useListCount` pattern already
in the role home tiles.

```text
For each tab (except all) i would like to have a dropdown to select the
status want to see for each tab
```

Added a dropdown narrowing the active stage to one status within it. The
first version nested the dropdown's trigger inside the tab list, which
broke an accessibility rule (a `tablist` may only own `tab` elements) and
left two tests asserting on raw request strings in a way that masked the
real failures. Iok Teck ran the tests and pasted the failures back twice;
found the two real bugs (a `pageSize=10` request wrongly matched a
`pageSize=1` filter, and the nested dropdown), moved the dropdown out of
the tab list into its own control, and rewrote the fragile tests to check
the visible outcome (which tab is selected, which chip appears) instead of
raw request strings.

```text
Can u put the Status: xxx below the filter chips
```

```text
Sorry I meant below the tabs
```

Split the dropdown out of the tabs component so the page could place it
independently, then moved it per each instruction.

## 2. A Docs column

```text
Update the Order Tracker table component in
`apps/web/src/features/order-tracker/` to add a micro-compact "Docs" column
between "Status" and "Owner". Render four one-letter badges (P, I, L, A) for
the purchase order, the invoice, the packing list and the AWB, each tiny
(w-5 h-5 text-[10px] font-bold rounded), coloured PASSED, FAILED or PENDING
with specific raw colours, and a hover tooltip on failed badges detailing
the mismatch.
```

Checked what the tracker list's data actually carries before building
anything: `TrackerOrder` has no per-document check result, only an
aggregate `openExceptions` count; the per-document detail (`documentType`,
pass or fail, the mismatch) only exists on the order's own detail page.
Flagged two choices rather than guessing: whether to extend the mock list
API to carry real per-document data, or keep this frontend only and derive
a concept from the fields already on the row; and whether to use the raw
colours given, which exist nowhere else in the codebase, or this app's own
tokens (`text-success`, `text-destructive`, and so on), which every other
badge already uses for light and dark mode.

```text
Dont build the backend, just the frontend will do to show a concept. For
the colours just use the default use in the app.
```

Built `DocsBadges.tsx`: each badge's state comes from the stage the order's
real status sits in (the same five stages as the tabs) and the order's own
`openExceptions` count, never fabricating a failure where that count is
zero or the status matches none of the five stages. Colours use the app's
existing tokens. Each badge carries a tooltip and an `aria-label`, so the
reason is read out, not only shown on hover.

## 3. The Status column's own filter

```text
Refactor the Order Tracker table component in
apps/web/src/features/order-tracker/.

1. Remove the floating status filter dropdown ("Status: Any status in this
stage") located above the search bar.
2. Update the "Status" table column header (<th>) to include an inline
filter dropdown menu: a chevron next to the label, a popover listing the
active stage's sub-statuses with "All sub-statuses" at the top, and a
visual highlight on the header whenever a specific sub-status is applied.
3. Keep the sub-status filter working alongside the stage tab, search and
the overdue filter.
```

Found that the column header only ever took a plain string, with no way to
hold a menu trigger, so added an optional `headerContent` field to the
shared `DataTableColumn` type (`apps/web/src/components/common/
data-table/`) and used it only for the Status column, keeping every other
table's columns unchanged. Moved the old floating dropdown's logic into a
new `StatusColumnFilter`, disabled until a stage tab (not "All") is open,
since there is then no one stage's statuses to narrow, and reused the
existing `status` filter so the table's other filters stay as they were.
Part way through, the shared type's edit was found lost between turns
(reverted outside the session); re-applied it and checked with `git status`
that the change actually landed on disk before the commit.

## 4. An exceptions badge on the Order No. column

```text
Refactor the Order Tracker table component in
apps/web/src/features/order-tracker/.

1. Remove the standalone "Open exceptions" table column (<th> and <td>).
2. In the "Order No." table column: render a compact, pill-styled red
badge displaying just the count next to the Order ID whenever
openExceptions > 0. If openExceptions === 0, render nothing.
```

Removed the column, and added the badge beside the order number's link
using the app's own destructive tokens (the same ones already settled on
for the Docs column), with an `aria-label` stating the count in words,
since the bare digit alone means nothing to a screen reader. Dropped the
column's own locale key, now unused, and added a pluralised one for the
badge's label.

## 5. The Status chip's rules

```text
Refactor the active filter pills logic in
apps/web/src/features/order-tracker/.

1. Do not render a green filter pill if "All sub-statuses" is selected for
the current stage tab, since the active top tab already says that. Only
render a pill once a specific sub-status is chosen from the Status column's
own dropdown.
2. Format the pill as "Status: <value>", or "Status: N selected" once more
than one sub-status is picked. Clicking the pill's X resets the sub-status
filter back to "All sub-statuses in this stage", not away from the stage.
```

Changed `trackerChips` to compare the filter's status codes against the
active stage's whole group (`stageTabOf` plus `groupStatusOf`) and skip the
chip when they match. The generic `FilterChips` clear button only ever
deletes a filter's key; rather than change that shared component, the
page's own `onChange` now re-fills `status` with the stage's whole group
when clearing drops it, so the stage tab stays open and only the narrowing
is undone.

## 6. An exceptions-only filter

```text
Update the Order Tracker page component in
apps/web/src/features/order-tracker/.

1. Add an "Exceptions only" checkbox beside the existing "Overdue only"
checkbox, matching its styling.
2. Create an exceptionsOnly boolean state (default false). Filter the rows
to orders with openExceptions > 0 when true. Keep it working alongside the
stage tab, the sub-status filter, search and overdue. Reset to page 1 on
toggle.

U can just extend the mock api
```

Unlike the Docs column, read the go-ahead to extend the mock API as
meaning the full pipeline, not a frontend-only concept this time: the
shared `trackerQuerySchema` (`packages/shared`), the tracker service's
filter pass (`apps/api`), and the generated client (`pnpm api:generate`,
checked with `pnpm api:check`), not only the web screen. The toggle reuses
the table's existing generic switch markup, so the styling match and the
reset to page 1 came from the table's own code, not a hand-copied control.

```text
I just realise the exceptions only toggle should only show those with
exceptions, the one with the numbers beside the order no.?
```

Confirmed: both read the same `openExceptions` field, so the toggle shows
exactly the rows carrying that badge.

## Review

Iok Teck ran `pnpm vitest` (and, from section 6, `pnpm typecheck`) after
each round and pasted the real pass and fail counts back; nothing here is
reported as passing without that. `pnpm typecheck`, run for the first time
on this branch in section 6, found two pre-existing, unrelated type errors
in `trackerParams.ts`, where `.includes()`'s parameter type had collapsed
to `never` across the five lifecycle stages' union type; fixed with the
same cast already used for the same problem in `mock-sales-flow.ts`.
`pnpm api:check` confirmed the regenerated client matched what CI expects.
A stray, unrelated and already-broken edit to another area's
`home-counts.test.ts`, found in the working tree during section 6, was left
alone and removed by Iok Teck directly.
