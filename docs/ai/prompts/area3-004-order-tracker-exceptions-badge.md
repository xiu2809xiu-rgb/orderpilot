# Prompt area3-004: an exceptions badge on the Order No. column

Iok Teck's prompt for the order tracker frontend prototype, on branch
`feat/area3-order-tracker-frontend-prototype`, as written.

## 1. The ask

```text
Refactor the Order Tracker table component in
apps/web/src/features/order-tracker/.

Requirements:
1. Remove the standalone "Open exceptions" table column (<th> and <td>).
2. In the "Order No." table column: render a compact, pill-styled red
badge displaying just the count next to the Order ID whenever
openExceptions > 0. If openExceptions === 0, render nothing.
```

The AI removed the column, and added the badge beside the order number's
link using the app's own destructive tokens (the same ones already settled
on for the Docs column), with an `aria-label` stating the count in words,
since the bare digit alone means nothing to a screen reader. It dropped the
column's own locale key, now unused, and added a pluralised one for the
badge's label.

## Review

Iok Teck asked for the test command to run and report back before this is
called done.
