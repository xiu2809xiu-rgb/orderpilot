# ADR 0045: A document form is declared, and the document form template draws it

- **Status:** Accepted
- **Date:** 2026-11-06
- **Story:** P-47, the document form (issue 142)

## Context

Orders, SPRs, payment confirmations and shipments are all edited on the same kind of page: a header of fields, lines, a footer, a row of actions, and the history below. [ADR 0037](0037-a-list-is-declared-and-the-template-draws-it.md) did this for lists, and P-46 and P-48 gave the pieces a form is made of (the form kit with its drafts and server errors, and the lines grid). Without a template, each of the next four CRUD stories (P-49, P-61, P-62, P-63) would build its own bar, decide for itself which buttons a role sees, and write its own Void dialog.

## Decision

1. **A screen declares, the template draws.** `DocumentForm` (in `components/document-form`) takes the form from `useZodForm`, the header fields, an optional lines grid, a status, attachments and footer figures, the actions, and the tabs. It draws the title, the action bar, the header, the lines, the footer and the tabs, and uses the form kit for everything that touches the form: `useFormSave`, `useSaveShortcut`, `useDraft` and `FormShell`.
2. **The action bar is the permission check.** An action is drawn only if the form declares it and the role holds its permission, as in ADR 0037. The kinds are Save, Save and new, Submit for approval, Approve, Reject, Print or PDF and Void, always in that order. Save is the one primary button; a role that cannot save gets Approve, then Submit, as its primary. The server still refuses what the role may not do.
3. **A blocked action says why.** An action the document cannot take now stays reachable and gives its reason (the screen's `blocked`, or "Save your changes first" for Submit, Approve, Reject and Void while the form has unsaved changes, so they never act on a record that differs from what is on screen).
4. **Save and Save and new share one save.** Both go through `useFormSave`; `onSave(values, andNew)` receives which one was pressed and `onSaved` starts the next document. Ctrl+S is Save, and is inert when Save is not available.
5. **Void and Reject ask why.** They carry a `reasoned` block, and the template opens the list template's `ReasonDialog` (P-44) with the same schema and wording, so one reason dialog serves lists and forms.
6. **The draft belongs to the template.** The screen passes a `draftKey` and the template calls `useDraft`, so no document form can forget it: unsaved changes survive an expired session and a reload, and masked fields are left out through `draftOptions.exclude`.
7. **Tabs under the form.** Timeline, Checks and Documents take a count of what needs attention and their content, or null for a compact one-line empty state. Operation log is read from the record-scoped route of ADR 0043, only once it is opened, and is not drawn for a role that may not read that kind of record. It carries no count: nothing in a log needs attention.
8. **Print or PDF is the browser's print view.** The screen gives a function that returns the title, the fields, the lines and the totals as text; the template writes them into a hidden frame of its own and opens the print dialog, where "Save as PDF" is the PDF. The same approach as the list's print (`printer.print` is the seam), with no dependency. B-3 replaces it with generated documents.
9. **One place to add shared actions.** `registerDocumentFormItem` takes an id, a `common` label key, an icon and a permission, and the item appears in every document form's More menu, as `registerRowMenuItem` does for row menus. P-57 registers Pin to top, Remind me and Add to my to-dos once, for lists and forms alike.
10. **Statuses stay with the screen.** The template draws a status chip from a family and a word the screen passes, so no state is listed in the template (ADR 0025, ADR 0037).

## Consequences

- A real order form is a declaration: schema, fields, `actions` and `tabs` (see CONTRIBUTING.md, "Building a document form"). A change to the bar is one change for every document.
- No `orders.write` or other write permission exists yet. The gallery uses `orders.read` for the actions of the record's own work and `approvals.decide` for Approve and Reject. Each CRUD story names the permission its actions need; area 4 owns the matrix.
- Submit, Approve, Reject and Void are calls the screen makes. The template never changes a status: it lives only in area 2's state machine.
- The footer has attachments, the status chip and a list of figures. The lines grid draws its own line totals; `totals` is for header-level figures such as freight and the grand total, so a document does not show the sum twice.
- A test that renders the real i18n namespaces needs `document-form` loaded, as the other namespaces are.

## Alternatives considered

- **Each CRUD story draws its own bar.** Four copies of the permission check and the Void dialog.
- **A `<DocumentForm>` that owns the form and the schema.** The schema belongs in `packages/shared` when the API checks the same thing, so the screen keeps `useZodForm`.
- **Printing the page itself with `window.print()`.** The page holds menus, tabs and a scrolling grid, so it prints a fragment.
- **A PDF library now.** B-3 brings generated documents; a library for a stopgap is weight in the bundle.
