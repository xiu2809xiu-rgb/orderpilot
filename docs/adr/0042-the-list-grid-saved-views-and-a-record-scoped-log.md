# ADR 0042: The list grid, saved views, a streamed print and a record-scoped operation log

- **Status:** Accepted
- **Date:** 2026-11-05
- **Story:** P-45, the list template: grid, saved views and operation log (issue 141)

## Context

[ADR 0037](0037-a-list-is-declared-and-the-template-draws-it.md) gave every list one declared page, and left three things for this story: the checkboxes that actions on picked rows wait for, the pieces a person keeps for themselves (views and columns), and a print that does not hold a long list in the page. [ADR 0027](0027-audit-viewer-base.md) gave record pages an operation log fed from the audit trail, but only for roles that may read the whole trail (`audit.read`). A list under `/order-tracker` is read by roles that cannot read the audit trail, and they should still see who did what to the record they picked.

## Decision

1. **The list page owns the selection.** `ListPage` keeps the ticked rows by their row key in `useRowSelection`, so a refetch keeps a tick and a row that leaves the page leaves the selection. A new page, search, filter or sort clears it: selecting is for the page on screen. The grid (`DataTable`) only draws what it is given (`selection`: is this row ticked, toggle, toggle the page, and the state of the header box), so the screens that do not declare actions on picked rows (audit) are unchanged and draw no checkbox. The count is a live region that is always in the page, and the bar's batch actions take the ticked rows and clear them when they finish. The checkboxes are drawn only when an action needs rows, or the screen asks for the operation log.
2. **One row menu, with one place for My work.** A row menu offers View, Edit, Copy and Void (or Disable) where the screen declares them, each for that row alone, whatever is ticked. `registerRowMenuItem` is the single place a feature adds an item that every list's menu shows between Edit and Copy: P-57 registers Pin to top, Remind me and Add to my to-dos there, with no change to any list. A list with nothing to put in its menu has no menu column.
3. **Saved views replace saved filters.** A saved view holds the search, the filters, the sort and the columns (which are shown, and in what order), per person, in that person's browser, as saved filters did ([ADR 0023](0023-exceljs-for-table-export.md) and the P-12 data table). A copy saved before views kept columns still reads, and applying it leaves the columns alone. Column settings are one menu: show, hide, and move up or down by button, so the order works from the keyboard and on a tablet (no drag). A column that cannot be hidden stays where the screen put it. Nothing about a view is sent to the server: it is a convenience, not data.
4. **Print streams into a frame of its own.** Print writes the list into a hidden frame, a page of rows at a time as `loadPage` returns them (200 rows a request), and calls the frame's print. The app's page never holds more than the rows on screen, and the screen says how far it has got. The frame's table repeats its title row on every printed page and each page's margin carries "Page n of N". Rows are written as text, never as markup. A screen with no `loadPage` prints the rows it has. This replaces P-44's portal, which put every row into one table in the page.
5. **The record-scoped log is a new read, in area 1's platform code.** `GET /operation-log/:entityType/:entityId` (module `apps/api/src/modules/operation-log/`) answers who, when and what for one record, newest first, from the audit trail. It reads through `AuditEventRepository` (one additive filter, `withoutRefusals`) and the user repository. Area 4's audit module is unchanged.
6. **Who may read it is the record's own permission.** `OPERATION_LOG_READERS` in `packages/shared` maps each kind of record to the permission that reads it: a user's log needs `users.read`, an order's `orders.read`, an exception's `exceptions.read`, and so on. A new decorator, `@RequirePermissionOf`, lets the permissions guard name the permission from the route's params and ask area 4's policy about it, exactly as for `@RequirePermission`. A kind with no entry names no permission, and the route is refused (deny by default). Every refusal is audited by the guard, as for every route. **Area 4 reviews this rule:** the map is the proposal, and the policy still decides.
7. **A line is built field by field.** An entry is its id, its time, who acted (a person's name and role, or the system part or model) and the event's summary. It is never a field value, an IP address, a trace id or a hash, whatever the event gains later: those stay in the audit trail, for the roles that may read it. The summary is the sentence the audit writer composes, which by its contract ([ADR 0027](0027-audit-viewer-base.md), point 6) holds no value a masking rule would hide. Refusals are left out of a record's log: it says what was done to the record, and who tried and failed is the audit trail's business.
8. **The panel asks only when it may.** `RecordLogPanel` is drawn only for a role that holds the reader permission for that kind of record, and asks only when exactly one row is ticked, so a role that may not read the record never makes a call that would be refused. If the server refuses anyway, the panel says so.
9. **No owner screen moves in this story.** The order tracker and the exceptions queue (area 3), the task inbox (area 2) and the users tab (area 4) keep their own screens. A first build moved all four onto the template; it is parked on the branch `wip/p45-owner-screens`. Each owner moves their list in a small pull request of their own (the task inbox in P-38, exceptions in P-73, the tracker in P-74, governance in P-76), which they review, and the template already offers what they need: a list declares `selectable`, `rowMenu`, `views` and `operationLog`.
10. **A phone shows a summary, not a sideways scroll.** Below 768 px the first column carries the next two columns under it, and those two columns are hidden in the heading and in every row, so nothing is shown twice or clipped. They stay in the table above 768 px and in a printout.

## Consequences

- A list with checkboxes, a row menu, views, columns, print and a log costs one declaration; a change to any of them is one change for every list.
- Print no longer shows a preview inside the app. The browser's print dialog is the preview.
- Until the owners move their lists, only the master data lists and the gallery use the checkboxes, row menu, views and log; the tracker, exceptions queue, inbox and users tab are unchanged.
- On a phone (under 768 px) the first column of a list carries the next two columns under it, so a row shows more than its number; the full columns still scroll sideways.
- A record's log shows nothing for a kind of record until something writes its events through the audit writer. It says so in its empty state.
- The log is a different sentence to the audit viewer's detail: the viewer shows changes, masked by role, and this shows only who, when and what.

## Review notes for the owners

- **Area 4 (Angelyn) reviews more than a rule.** Besides `OPERATION_LOG_READERS` in `packages/shared`, the story edits files on the enforcement path: `apps/api/src/auth/decorators.ts` (the `@RequirePermissionOf` decorator), `apps/api/src/auth/guards/classification.ts`, `apps/api/src/auth/guards/permissions.guard.ts` (it reads the permission the decorator names), `apps/api/src/audit/audit-event.repository.ts` (a `withoutRefusals` filter) and `apps/api/src/users/user.repository.ts` (role and search filters for the users list). `apps/api/src/modules/governance` is untouched. A test fails when the guard skips the policy loop.
- **Areas 2, 3 and 4 get no screen change.** Their folders are as on `main`. The parked work in `wip/p45-owner-screens` shows what a move looks like, and each owner decides whether to use it.
- **Entity ids for the panel.** The Order and Exception logs are empty today because no audit writer records events under those entity types. Areas 2 and 4 settle the id convention when orders and exceptions start writing events; the record-scoped route already serves any type listed in `OPERATION_LOG_READERS`.

## Alternatives considered

- **Selection inside the data table.** Every table would own and clear it; the list page, which knows when the query changes, is the one place that can.
- **Drag to order columns.** It needs a drag library and does not work from the keyboard. Buttons do.
- **Reusing `GET /audit/events` for the panel.** It needs `audit.read`, and it carries changes and addresses that a tracker reader must never see.
- **A permission per route for every kind of record.** Seven near-identical routes. One route with a map is smaller and easier for area 4 to review.
- **Printing from the app's page with a print stylesheet.** The page holds one page of rows, so a long list needs every row loaded into it.
