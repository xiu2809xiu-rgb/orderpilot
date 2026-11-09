# Prompt area3-005: the Status chip's rules

Iok Teck's prompt for the order tracker frontend prototype, on branch
`feat/area3-order-tracker-frontend-prototype`, as written.

## 1. The ask

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

The AI changed `trackerChips` to compare the filter's status codes against
the active stage's whole group (`stageTabOf` plus `groupStatusOf`) and skip
the chip when they match. The generic `FilterChips` clear button only ever
deletes a filter's key; rather than change that shared component, the page's
own `onChange` now re-fills `status` with the stage's whole group when
clearing drops it, so the stage tab stays open and only the narrowing is
undone.

## Review

Iok Teck ran the tests after this change and after the Status column
change before it, and reported a real failure both times (a stale
assertion expecting the old unprefixed chip text, and a disabled dropdown
test) before this was called done.
