# Prompt 004: An ERP-grade workspace

On 1 Nov, Richie compared OrderPilot with a real ERP that companies like Spectra use every day. The new home pages work. But the app still doesn't behave like a business system:

- **No records can be changed.** You can't create, edit or void anything.
- **The navigation doesn't follow the business.** It isn't organised by business function.
- **There's no document form with lines.**
- **Access is a grid of switches.** That grid is the only way to manage who may do what.
- **There are no personal tools:** no pins, no reminders, no to-dos.

This prompt fixes that.

Prompts 001, 002 and 003 still apply.

- **Order:** finish prompt 003's open items (orders, documents, the inbox, SPR approval, exceptions, insights, hiding unfinished menus), but build them on this prompt's templates, so nothing is built twice.
- **Handover:** the prompt that writes each area's stories is now **prompt 005**.

## 1. Principles

- **Familiar to ERP users.** It should feel familiar to people who use Navision, and to users of the inventory system Richie studied. That means:
  - navigation by module;
  - list, then record, then document form;
  - action bars;
  - status shown everywhere.

  Patterns, not copies (prompt 002, section 5).

- **OrderPilot owns some records and reads others:**
  - **Full CRUD where OrderPilot owns the record.** That covers orders (sales orders captured from POs), documents, SPRs, payment confirmations, shipments with their AWB/BL numbers, exceptions, users, roles, approval limits, settings for checks and reminders, layout mappings, connectors, and each person's pins, reminders and to-dos.
    - Create, read and update them, then void or disable them with a reason. Never hard-delete a business record, and audit every change.
  - **Read-only where Navision owns the record.** That covers customers, vendors, items, prices and stock.
    - Each page says **Managed in Navision** and offers **Request a change**. This creates a change request, and an authorised person approves it before it is applied.
    - A change to a vendor's bank details goes through area 4's control.
    - Mock Navision gets a **Demo data** page, for System admin only and labelled as demo only, to add and edit test records.
- **Each role sees only what it may.** Every role sees only its own modules, records and fields: permissions, plus data scope, plus masking. A screen never shows a button the role can't use, and the server still refuses it.

## 2. The workspace

- **Module navigation.** Each role sees only its own modules:

  | Module      | Pages                                                                            |
  | ----------- | -------------------------------------------------------------------------------- |
  | Home        | Home                                                                             |
  | Sales       | Orders, Proforma invoices, Shipments                                             |
  | Purchasing  | SPRs; Vendor POs (phase 2)                                                       |
  | Warehouse   | Pick and pack; Goods receipt (phase 2)                                           |
  | Finance     | Payments; Vendor payments (phase 2)                                              |
  | Documents   | Inbox, To review                                                                 |
  | Master data | Customers, Vendors, Items                                                        |
  | Reports     | Order tracker, Exceptions, KPIs                                                  |
  | System      | Users, Roles, Approval limits, Rules, Mapping, Connectors, Audit log, Monitoring |
  - Phase 2 pages stay hidden until they're built.
  - A menu item that holds waiting work shows its count, for example "SPRs 10".

- **Records open as tabs** in a strip under the top bar, like an ERP workspace:
  - opening an order, document or SPR adds a tab;
  - the tabs survive a reload, and Ctrl+click opens a record in a new tab;
  - each tab has a close button, and there are at most ten.
- **Breadcrumbs stay.**

## 3. Two templates for every screen

- **The list page:**
  - **Filter bar:** a quick search, the three or four filters that matter, and More filters.
  - **Action bar:** New, Edit, Void or Disable, batch actions on the selected rows, Import where it makes sense, Export and Print.
  - **Grid:** row checkboxes, status chips, and a row menu with View, Edit, Pin to top, Remind me, Add to my to-dos, Copy and Void.
  - **Around it:** saved views, column settings, pagination, and the selected record's operation log in a panel at the foot.
- **The document form**, for orders, SPRs, payment confirmations and shipments:
  - **Header:** a grid of the header fields.
  - **Lines grid**, with inline editing:
    - item lookup by part number or name;
    - quantity, unit price, amount and availability;
    - Enter adds a line, and Delete removes one.
  - **Footer:** totals, attachments, and a status badge.
  - **Action bar:** Save, Save and new, Submit for approval, Approve or Reject when the role may, Print or PDF, and Void.
  - **Below the form:** tabs for Timeline, Checks, Documents and Operation log.
  - Unsaved changes survive an expired session.
- **Validation** is inline, field by field, and uses the server's error messages.

## 4. CRUD, in this order

1. **Orders** (prompt 003, item 6, on the new templates):
   - list them;
   - create one from scratch, or from a confirmed PO document;
   - edit it while it's a draft;
   - submit it, cancel it with a reason, or copy it.
2. **SPRs:**
   - create one from a shortage line, pre-filled;
   - edit it while it's a draft;
   - submit it, or withdraw it.
3. **Payment confirmations** (Finance): record them, edit them before they're confirmed, and void them with a reason.
4. **Shipments** (Logistics):
   - record the forwarder, the AWB/BL number and the dates;
   - edit them, or void them.
5. **Users and roles** (System):
   - **Users:** a list and a form with name, email, role, data scope and status. Create, edit, disable, re-enable, and reset the demo password.
   - **Roles:**
     - a list of roles;
     - a page for each role, with its permissions grouped by module as checkboxes, "Select all in module", its data scope, and "Copy role".
     - Keep the full grid only as a read-only **Compare roles** view.
   - **Names:** show plain names everywhere, never raw keys like `permissions.tracker.read`.
6. **Settings forms** (forms only, never the logic behind them):
   - approval limits for each approver, in the same shape as Navision's Approval User Setup;
   - area 3's check tolerances;
   - area 2's reminder rules.
7. **Master data:** change requests, and the mock Navision Demo data page.

## 5. My work: pins, reminders and to-dos

Every row menu and record page gets three actions: **Pin to top**, **Remind me** and **Add to my to-dos**. The home page gets a **My work** panel with four tabs:

- **Needs you:** the system's tasks for the role, as the home page shows now.
- **My to-dos:**
  - personal items: any record, added with "Add to my to-dos", or free text;
  - a due date and a done checkbox for each, and drag to reorder.
- **Reminders:**
  - "Remind me" on any record, either on a date, or when a condition holds, such as "if still unpaid on 5 Nov";
  - when it fires: a notification in the bell and on the home page, plus an email to Mailpit if the person chose one;
  - area 2's system reminders also appear here, marked "System".
- **Pinned:** pinned records show first on the home page, and float to the top of their own list, for that person only.

All four are personal and audited. They stay separate from area 2's workflow tasks and reminder engine, whose logic is Azri's. Personal reminders run on the platform's BullMQ queue.

## 6. Status indicators

- **One status system:**
  - each family of states has one colour and one icon: draft is grey, waiting is amber, approved or ready is green, blocked or overdue is red, and done is muted;
  - the same chip is used everywhere.
- **Timers:** overdue and SLA timers, such as "due in 3 h" and "2 days late".
- **Counts:** the sidebar and the tabs show counts of what needs attention.

## 7. The teammates' screens

- **UI only:** move the inbox, SPR approval, exceptions, tracker, insights, governance, audit and monitoring screens onto the templates.
- **Their logic stays theirs:** core logic stays `it.todo` for each owner.
- **Reviews:** ask each owner to review their area's pull request.

## 8. Check it

Do what prompt 003, section 4, asks, plus a Playwright test for every CRUD screen:

- an allowed role creates, edits and voids a record;
- a role without the permission sees no button, and the server refuses the call with 403.

## 9. Order and timing

- **First:** sections 2 and 3 (the workspace and the templates).
- **Then:** prompt 003's orders and documents, built on them.
- **Then:** section 5 (My work).
- **After that:** the rest of section 4, then sections 6 and 7.
- **The teammates start on Monday with their back-end core:** the state machine, the checks engine and the policy. Nothing in this prompt touches those.
- **Their screens move onto the templates in section 7,** in small pull requests, each reviewed by the area's owner.
