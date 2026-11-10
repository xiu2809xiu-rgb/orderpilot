# Prompt area3-003: the Status column's own filter

Iok Teck's prompt for the order tracker frontend prototype, on branch
`feat/area3-order-tracker-frontend-prototype`, as written.

## 1. The ask

```text
Refactor the Order Tracker table component in
apps/web/src/features/order-tracker/.

Requirements:
1. Remove the floating status filter dropdown ("Status: Any status in this
stage") located above the search bar.
2. Update the "Status" table column header (<th>) to include an inline
filter dropdown menu: a chevron next to the label, a popover listing the
active stage's sub-statuses with "All sub-statuses" at the top, and a
visual highlight on the header whenever a specific sub-status is applied.
3. Keep the sub-status filter working alongside the stage tab, search and
the overdue filter.
```

The AI found that the column header only ever took a plain string, with no
way to hold a menu trigger, so it added an optional `headerContent` field
to the shared `DataTableColumn` type (`apps/web/src/components/common/
data-table/`) and used it only for the Status column, keeping every other
table's columns unchanged. It moved the old floating dropdown's logic into
a new `StatusColumnFilter`, disabled until a stage tab (not "All") is open,
since there is then no one stage's statuses to narrow, and reused the
existing `status` filter so the table's other filters stay as they were.

## Review

Iok Teck asked for the test command to run and report back before this is
called done, and part way through found that the shared type's edit had
been lost between turns (reverted outside the session) and asked that it
be re-applied and verified before the commit, which the AI did, checking
with `git status` that the change actually landed on disk this time.
