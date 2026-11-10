# Prompt area3-002: a Docs column on the order tracker

Iok Teck's prompt for the order tracker frontend prototype, on branch
`feat/area3-order-tracker-frontend-prototype`, as written.

## 1. The ask

```text
Update the Order Tracker table component in
`apps/web/src/features/order-tracker/` to add a micro-compact "Docs" column
between "Status" and "Owner". Render four one-letter badges (P, I, L, A) for
the purchase order, the invoice, the packing list and the AWB, each tiny
(w-5 h-5 text-[10px] font-bold rounded), coloured PASSED, FAILED or PENDING
with specific raw colours, and a hover tooltip on failed badges detailing
the mismatch.
```

The AI checked what the tracker list's data actually carries before
building anything: `TrackerOrder` has no per-document check result, only an
aggregate `openExceptions` count; the per-document detail
(`documentType`, pass or fail, the mismatch) only exists on the order's own
detail page. It flagged two choices rather than guessing: whether to extend
the mock list API to carry real per-document data, or keep this frontend
only and derive a concept from the fields already on the row; and whether
to use the raw colours given, which exist nowhere else in the codebase, or
this app's own tokens (`text-success`, `text-destructive`, and so on),
which every other badge already uses for light and dark mode.

## 2. The answer

```text
Dont build the backend, just the frontend will do to show a concept. For
the colours just use the default use in the app.
```

The AI built `DocsBadges.tsx`: each badge's state comes from the stage the
order's real status sits in (the same five stages as the tabs) and the
order's own `openExceptions` count, never fabricating a failure where that
count is zero or the status matches none of the five stages. Colours use
the app's existing tokens. Each badge carries a tooltip and an
`aria-label`, so the reason is read out, not only shown on hover.

## Review

Iok Teck asked for the test command to run and report back before this is
called done.
