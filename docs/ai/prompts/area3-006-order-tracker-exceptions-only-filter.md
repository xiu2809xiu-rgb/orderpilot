# Prompt area3-006: an exceptions-only filter on the order tracker

Iok Teck's prompt for the order tracker, on branch
`feat/area3-order-tracker-frontend-prototype`, as written.

## 1. The ask

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

Unlike the Docs column (D-2), the AI read the go-ahead to extend the mock
API as meaning the full pipeline, not a frontend-only concept this time:
the shared `trackerQuerySchema` (`packages/shared`), the tracker service's
filter pass (`apps/api`), and the generated client (`pnpm api:generate`,
checked with `pnpm api:check`), not only the web screen. The toggle reuses
the table's existing generic switch markup, so the styling match and the
reset to page 1 came from the table's own code, not a hand-copied control.

## 2. The clarifying question

```text
I just realise the exceptions only toggle should only show those with
exceptions, the one with the numbers beside the order no.?
```

Confirmed: both read the same `openExceptions` field, so the toggle shows
exactly the rows carrying that badge.

## Review

Running `pnpm typecheck` (not run earlier in this branch) found two
pre-existing type errors in `trackerParams.ts`, unrelated to this story,
where `.includes()`'s parameter type had collapsed to `never` across the
five lifecycle stages' union type; fixed with the same cast already used
for the same problem in `mock-sales-flow.ts`. `pnpm api:check` confirmed
the regenerated client matches what CI expects. The API and web test
suites, the typecheck and ESLint were run and reported clean before this
was called done. A stray, unrelated and already-broken edit to another
area's `home-counts.test.ts` was found in the working tree, left alone,
and removed by Iok Teck directly.
