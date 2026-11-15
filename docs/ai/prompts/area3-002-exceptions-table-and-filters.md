# Prompt area3-007: the exceptions queue, aligned with the order tracker

Iok Teck's prompts for the exceptions queue, on branch
`feat/area3-tracker-exceptions-ui`, as written, in the order sent across the
session.

## 1. Aligning the table with the order tracker

```text
Update the frontend UI for the Exceptions table so it aligns visually with
the Order Tracker table. Keep changes strictly to frontend components-do
not modify backend APIs, mock data schemas, or tests.

Apply these exact changes in one pass:

1. Standardize Column Headers & Customer Styling:
   - Rename the Order column header in Exceptions to "Order No." to match
     Order Tracker.
   - Match the Customer cell styling from Order Tracker in Exceptions.

2. Clean Up the Check column:
   - Remove the "(sample result)" suffix from all check labels.
   - Shorten the check names for scannability (PL vs PO, PI vs PO, AWB / BL
     upload deadline).

3. Merge "What differs" and "Difference" into one Discrepancy column:
   - A two-line micro-cell: the subject/SKU on top, the exact comparison
     muted underneath, with a right-aligned monospace variance pill.
   - Clean singular/plural grammar on the variance (-1 unit, not -1 units).
```

A sample image of the target Discrepancy layout came with the ask. The
existing `ExceptionsPage.test.tsx` asserted the raw `summary` sentence and
the bare `difference` value verbatim, which the merged column's own
wording does not reproduce. Flagged the conflict and the options (keep the
test's exact wording and lose the compact layout, or ask to change the
test) rather than silently picking one.

```text
Ok should update the test. Also that screenshot i sent is a sample for
part of the exceptions table.
```

Confirmed: the test could change, and the screenshot was a style sample,
not a literal spec for every row.

## 2. Refining the Discrepancy layout, in rounds

```text
The exceptions table the part on discrepancy should look like this,
except maybe lessen the spacing between the left text and right pills
```

```text
The discrepancy column should follow a Two-Line Structure: ...
```

```text
For "The bill of lading was due on 2026-11-09 and has not arrived",
should just say "Bill of lading", and the second line should just say
"Due 8 Nov 2026" as an example. For Item discrepancies, the second line
should just say "PL: 18 · PO: 20" or "PI: $92.28 · PO: $90.78" ...
```

```text
Make the pill shaped discrepancy right aligned
```

```text
For the pill shape discrepancies, should say it shorter e.g., 2 units
fewer, 2 days late, + $1.50 / unit
```

```text
Instead of "15 units fewer than the PO" can just say "15 units fewer"
```

Each round landed in `DiscrepancyCell.tsx`: a per-check formatter keyed off
the already-shortened check label (`AWB / BL upload deadline`, `PL vs PO`,
`PI vs PO`), reading the item number out of the summary sentence with a
regular expression, formatting the tolerance's own unit into a worded
variance ("2 units fewer", not a signed number), and trimming a redundant
"than the PO" tail wherever the already-worded backend text carried it. A
rule the formatter does not recognise still falls back to splitting the
summary on its first colon, so nothing renders blank.

## 3. Sort and a check filter

```text
Now i want you to add a sort by feature for the exceptions table as well,
for the columns Order No., and Customer. For the column check, u can make
it a dropdown filter like in order tracker status column.
```

The order tracker's sort and its Status column filter are both server-side:
the shared `DataTable` component is built to never sort or slice rows
itself, and the tracker sends `sort`, `direction` and `status` to the API.
The exceptions API takes none of these (`exceptionQuerySchema` in
`packages/shared` has only `page`, `pageSize`, `search` and `state`), so a
real version of this needs the shared schema, the exceptions service and
the generated client regenerated, not only the screen. Set that plan out
and asked before touching anything outside the frontend.

```text
Ok good idea not to do any major changes, maybe can scope smaller
```

Scoped down to a frontend-only, client-side version: `visibleRows()` in
`ExceptionsPage.tsx` sorts and narrows the rows already fetched for the
current page, and `CheckColumnFilter.tsx` (new) reuses the order tracker's
`StatusColumnFilter` pattern for a dropdown over the three known check
labels. Both are called out as working on the current page only, not the
whole queue across pages, which stays the server's to decide.

## Review

Asked twice whether the tests could be run from here. The shell tool
failed on every command across most of the session (a `cd "<path>" ;`
prefix the harness injected was not valid in this environment's shell), so
each time this was reported as not run, rather than passed, and handed
back for Iok Teck to test directly.

```text
Ok tests passed, u can commit this now
```

The first commit of section 1's work failed lint-staged's ESLint step:
`@typescript-eslint/restrict-template-expressions` on a `number`
interpolated directly into a template literal in the variance formatter
(`${absolute}`); fixed by converting it to a string first. The first
commit of section 3's work failed commitlint's line-length rule on the
commit body; fixed by shortening the lines. Both committed clean once
Iok Teck gave the go-ahead.
