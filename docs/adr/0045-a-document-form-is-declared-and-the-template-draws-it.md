# ADR 0045: A document form is declared, and the document form template draws it

- **Status:** Accepted
- **Date:** 2026-11-06
- **Story:** P-47, the document form (issue 142)

## Context

Orders, SPRs, payment confirmations and shipments are all edited on the same kind of page: a header of fields, lines, a footer, a row of actions, and the history below. [ADR 0037](0037-a-list-is-declared-and-the-template-draws-it.md) did this for lists, and P-46 and P-48 gave the pieces a form is made of (the form kit with its drafts and server errors, and the lines grid). Without a template, each of the next four CRUD stories (P-49, P-61, P-62, P-63) would build its own bar, decide for itself which buttons a role sees, and write its own Void dialog.

## Decision

1. **A screen declares, the template draws.** `DocumentForm` (in `components/document-form`) takes the form from `useZodForm`, the header fields, an optional lines grid, a status, attachments and footer figures, the actions, and the tabs. It draws the title, the action bar, the header, the lines, the footer and the tabs, and uses the form kit for everything that touches the form: `useFormSave`, `useSaveShortcut`, `useDraft` and `FormShell`.
2. **The action bar is the permission check.** An action is drawn only if the form declares it and the role holds its permission, as in ADR 0037. The kinds are Save, Save and new, Submit for approval, Approve, Reject, Print or PDF and Void, always in that order. The one primary button is the first of Save, Approve and Submit that can run now, so a blocked Save never takes the emphasis from an Approve that is ready; if none can run, the first usable one. The server still refuses what the role may not do.
3. **A blocked action says why.** An action the document cannot take now stays reachable and gives its reason (the screen's `blocked`, or "Save your changes first" for Submit, Approve, Reject, Void and Print while the form has unsaved changes, so they never act on a record that differs from what is on screen, and the paper record never shows values the server has not accepted). A click on a blocked button shows the reason as text in a status line beside the bar, and the tooltip serves hover and keyboard. While one action runs, every other action and both saves wait with "Working", and when someone else has signed in every action is blocked.
4. **Save and Save and new share one save.** Both go through `useFormSave`; `onSave(values, andNew)` receives which one was pressed and `onSaved` starts the next document: after Save and new the template resets the form to the screen's `nextValues()` and clears the draft before it calls `onSaved`. A failure shows the server's words and trace id through the shared toast; a throw in `onSaved` is shown, never unhandled. Ctrl+S is Save, and is inert when the form declares no Save or the role may not use it: the template passes the shortcut a blocked reason, so the button and the key agree.
5. **Void and Reject ask why.** They carry a `reasoned` block, and the template opens the list template's `ReasonDialog` (P-44) with the same schema and wording, so one reason dialog serves lists and forms.
6. **The draft belongs to the template.** The screen passes a `draftKey` and the template calls `useDraft`, so no document form can forget it: unsaved changes survive an expired session and a reload, and masked fields are left out through `draftOptions.exclude`.
7. **Tabs under the form.** Timeline, Checks and Documents take a count of what needs attention and their content, or null for a compact one-line empty state. Operation log is read from the record-scoped route of ADR 0043, only once it is opened, and is not drawn for a role that may not read that kind of record. It carries no count: nothing in a log needs attention, so criterion 3 is narrowed for this tab on purpose. While the record is not in hand the screen passes `state` (loading, error with the server's words, trace id and Try again, denied or not found) and the template draws it from the list template's pieces, without mounting the form or restoring a draft.
8. **Print or PDF is the browser's print view.** The screen gives a function that returns the title, the fields, the lines and the totals as text; the template writes them into a hidden frame of its own and opens the print dialog, where "Save as PDF" is the PDF. The same approach as the list's print (`printer.print` is the seam), with no dependency. B-3 replaces it with generated documents.
9. **One place to add shared actions.** `registerDocumentFormItem` takes an id, a `common` label key, an icon and a permission, and the item appears in every document form's More menu, as `registerRowMenuItem` does for row menus. P-57 registers Pin to top, Remind me and Add to my to-dos once, for lists and forms alike.
10. **Statuses stay with the screen.** The template draws a status chip from a family and a word the screen passes, so no state is listed in the template (ADR 0025, ADR 0037).

## Consequences

- A real order form is a declaration: schema, fields, `actions` and `tabs` (see CONTRIBUTING.md, "Building a document form"). A change to the bar is one change for every document.
- No `orders.write` or other write permission exists yet, and the matrix is area 4's, so none was added. The gallery uses `orders.read` for Save, Submit, Print and Void and `approvals.decide` for Approve and Reject. The consequence is plain: in the gallery every role that reads orders, Auditor and Management included, sees Save, Submit and Void, and only Approve and Reject show the role rule. The real forms use the permissions their stories add (P-49, P-61, P-62, P-63), and `permission` is a single permission for now, so an action open to several would need an any-of form.
- A figure a role may not see is a `MaskedValue`, and an attachment a role may not open is left out; the API refuses the download too. The template links only relative and http(s) attachment addresses.
- Print adds the status to the printed fields, and a second Print while a print frame is open does nothing. The Ctrl+S shortcut is inert when no usable Save exists. `DocumentAction` is a union by kind, so a Void without `reasoned` does not compile, and two actions of one kind warn in development. A `notices` slot sits between the bar and the header for the approval route (P-61) and a payment hold (P-62). A registered shared item may limit itself with `appliesTo`, and registering an id twice warns in development.
- The gallery's three save shortcuts (form kit demo, lines grid demo, document form) all answer Ctrl+S on that page; a real screen mounts one form. A field's AI confidence in the form kit is left for the stories that fill fields from extraction.
- Submit, Approve, Reject and Void are calls the screen makes. The template never changes a status: it lives only in area 2's state machine.
- The footer has attachments, the status chip and a list of figures. The lines grid draws its own line totals; `totals` is for header-level figures such as freight and the grand total, so a document does not show the sum twice.
- A test that renders the real i18n namespaces needs `document-form` loaded, as the other namespaces are.

## Alternatives considered

- **Each CRUD story draws its own bar.** Four copies of the permission check and the Void dialog.
- **A `<DocumentForm>` that owns the form and the schema.** The schema belongs in `packages/shared` when the API checks the same thing, so the screen keeps `useZodForm`.
- **Printing the page itself with `window.print()`.** The page holds menus, tabs and a scrolling grid, so it prints a fragment.
- **A PDF library now.** B-3 brings generated documents; a library for a stopgap is weight in the bundle.
