# ADR 0038: The lines grid is an ARIA table that redraws one line at a time

- **Status:** Accepted
- **Date:** 2026-11-03
- **Story:** P-48, the lines grid (issue 143)

## Context

Support will spend the day typing order lines. The grid has to be fast from the keyboard, read as a table to a screen reader, stack on a phone and stay a grid on the warehouse's tablet, and show the same lines read-only for a saved record. Prompt 004 asks for no new dependency, and for 200 lines to stay usable without a virtual list.

## Decision

1. **A table made of roles, not of `<table>` elements.** `role="table"`, `row`, `columnheader` and `cell` on a CSS grid. A real `<table>` loses its semantics in some browsers once CSS changes its `display`, and the phone layout has to change it. The column headers stay in the tree on a phone, hidden from sight only, so each input keeps its place in the table.
2. **The layout follows the grid's own width, not the window's.** Container queries (`@3xl`, 768 px of the grid) switch between one row per line and a stacked block per line. The side menu changes the room a grid has, so a window width would stack it at the wrong moment.
3. **React Hook Form's `useFieldArray`, with each cell watching only its own values.** A line is a memoised component that takes only its position. Its amount, stock and error mark each `useWatch` their own fields, so a keystroke redraws that line and the footer. The measured results are in the pull request.
4. **Amounts are derived, not stored.** The line's amount and the totals are worked out from the quantity and price strings with the shared decimal helpers on every change. There is nothing to keep in step with the form, nothing to leave out of a draft, and a masked price can never leak through a stored amount. The server's totals win through one rule: they are shown until a line changes after they arrive.
5. **One key handler for the whole grid.** It sits on the grid, finds the line and cell from data attributes, and gives way to a text field for everything a text field does: Delete, the left and right arrows and its own text. Only Ctrl+Delete and Alt with an up or down arrow reach into one. The Escape key leaves a cell for its line, where Delete removes it.
6. **The line carries its own id** (`lineId`), and a draft matches restored lines on it, so a deleted line cannot hand its neighbour a price or a stock figure.
7. **No virtual list.** Measured at 200 lines, typing redraws one line. A virtual list would break find in the page, the table's row count for a screen reader and the arrow keys at its edges, for no gain at this size.

## Consequences

- A screen declares columns as data and gets keys, lookup, totals, stock, errors, masks and a read-only view. An SPR leaves out the price columns and the grid follows.
- Roles for a table are the screen reader's table pattern, not a data grid: a person moves with Tab, the arrows (off a text field) and Enter, and the cells are not a single tab stop. This is what the brief asks, and it is fewer surprises for a form.
- The grid needs a `FormShell` above it, since the kit's lookup and field array read the form from context.
- Past about a thousand lines the page would need a virtual list. Orders do not get there.

## Alternatives considered

- **AG Grid or TanStack Table.** A new dependency, its own focus model, and a licence to check, for a grid that is mostly typing into form fields the kit already provides.
- **A real `<table>`.** Simplest markup, but the stacked phone layout cannot keep its semantics.
- **A virtual list.** Not needed at this size, and costly for accessibility.
- **Storing the amount in the form.** One more field to keep in step on every edit and to leave out of a draft when masked.
