# ADR 0037: A list is declared, and the list page template draws it

- **Status:** Accepted
- **Date:** 2026-11-03
- **Story:** P-44, the list template: filter bar, action bar and status chip (issue 140)

## Context

Prompt 004 asks for one list page everywhere: a quick search, the filters that matter and More filters, an action bar (New, Edit, Void or Disable, batch actions, Import, Export, Print), applied filters as chips, and a status chip with five families. Before this story each list built its own bar from `DataTable`'s toolbar and a `filterSlot`. Two hooks kept the address (`useUrlTableQuery` kept only the filters, `useUrlQuery` in master data kept more), and `FilterSelect` lived in one feature's folder. The next ten lists would have copied whichever was nearest.

## Decision

1. **A screen declares, the template draws.** `ListPage` (in `components/list-page`) takes the columns, the row key, the filters (id, label, kind, options, `more`), the actions (kind, label, icon, permission, what they need selected) and the query result as the generated hook returns it. It draws the header, the action bar and filter bar, the applied-filter chips and the grid, and keeps every state.
2. **The action bar is the permission check.** An action is drawn only if the screen declares it and the signed-in role holds its permission, so no button is shown that the server would refuse. The server still refuses it. Export and Print are the template's own work; the others call `onRun`. New is the one primary button, and the N key runs it. Void and Disable carry a `reasoned` block, and the template then asks for the reason in one shared dialog (`ReasonDialog`, with `actionReasonSchema` from `packages/shared`) before it calls the screen, and ends with `toast.done`.
3. **Selection is a contract, not a feature.** An action that needs rows (`needs: "one" | "many"`) stays reachable but blocked, with its reason, until the screen passes `selection`. P-45 brings the checkboxes and supplies the selected rows; no action changes. An action can also say, with `enabledFor(rows)`, why the rows selected cannot take it (an SPR that is not waiting for approval), and stays blocked with that reason.

   Filters come in four kinds: a select, a lookup (a select with a search box, for customers or vendors, valued on the Navision number), a toggle and a date range (`idFrom` and `idTo`, from `rangeSpec`). A filter drawn but missing from the `useUrlQuery` spec would do nothing, so development throws and names it.

4. **One URL hook.** `useUrlQuery(spec, { pageSize })` in `components/common/data-table` keeps search, filters, page, sort and page size in the address, reads them back on a reload, leaves other parameters alone, and replaces a value the API would refuse (a page size over 200, a page that is not a safe whole number, a search over 100 characters, a text filter over 60, a date that is not a real day) with the default or cuts it. `apiParams` and `allPages` moved with it. `useUrlTableQuery` and the master data copy are gone.
5. **`DataTable` gets a `toolbar` slot.** The default toolbar stays for pages that have not moved. The table's state (visible columns, sort note, filter changes) moved into `useDataTableState`, which is how `DataTable` came under 200 lines without squeezing them.
6. **Print is a portal and a stylesheet.** `PrintView` is rendered into `document.body` beside the app, hidden on screen, and a `@media print` rule hides everything else in the body while it is there. It holds the title, the applied filters, the date, the "Synthetic demo data" label and every row the filter shows (fetched through the same `loadRows` as Export), in the columns on screen. No dependency.
7. **`StatusChip` takes a family and a word.** The five families (draft, waiting, ready, blocked, done) each have one colour from the tokens and one Lucide icon; no family shows neutral. The prop is the family, so no status code is listed in this code, as [ADR 0025](0025-area-3-reads-status-through-a-port.md) asks.

## Consequences

- A new list is one file of declarations (see CONTRIBUTING.md, "Building a list"). A change to the bars is one change for every list.
- The tracker and the exceptions queue change one import each (`useUrlTableQuery` to `useUrlQuery`). They also get page, sort and page size in the address, which the old hook kept in memory.
- Reading a list's `pageSize` from the address means a link can carry a size that is not in the page-size menu. The menu then shows the size it cannot name; the default is used only for a size the API refuses.
- The print view holds all rows in the DOM for a moment. A list of many thousands would need a streamed print; the lists here are paged at 200 per request and counted in hundreds.

## Alternatives considered

- **A `filterSlot` per page, as before.** Every page would keep drawing its own selects and chips, and "More filters" would be copied.
- **`window.print()` on the page itself.** The grid scrolls inside its own region and holds only one page of rows, so it prints a fragment.
- **A print library or a PDF.** More weight in the bundle for a plain table.
- **Enumerating statuses in `StatusChip`.** It would repeat ADR 0025's mistake in the web app and break whenever the state machine gained a state.
