# Personas

We began from the role table in [CLAUDE.md](../../CLAUDE.md#roles), listing for each role its work today and what would make that work easier. These are proto-personas, built from the brief before we have met anyone at Spectra. The names are invented, except Janet, whom the brief names as the approver.

## The roles

| Role                 | What it does today (from the brief)                                                                 | What would help                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Product Manager      | Watches their brands' stock, raises SPRs, and chases the approver                                   | An SPR pre-filled from a shortfall, its approval visible, and only their brands' orders and stock        |
| Approver (Janet)     | Approves or rejects SPRs and requests, from emails and paper                                        | Each request with its checks done and documents attached, within the approval limit, and fewer reminders |
| Support              | Re-types POs into Navision, makes PIs, invoices and packing lists, and answers "where is my order?" | Fields read for them, only doubtful ones to confirm, drafts to send, and one list of what waits on them  |
| Warehouse            | Packs paid orders, and compares deliveries by eye with the paperwork: invoice, packing list, AWB/BL | A packing task only after payment, and documents side by side with differences flagged, on a tablet      |
| Finance              | Confirms customers' payments, pays vendors on the due date, and checks vendors' bank details        | Payment status per order, vendor payments due, and a hold whenever bank details change                   |
| Logistics            | Books forwarders, and follows shipment dates, AWB/BL and import permits                             | Shipments by status, with overdue papers flagged and shipping details sent without re-typing             |
| Management           | Asks around to learn how orders are going                                                           | One tracker, and the five measures measured                                                              |
| Auditor              | Checks after the event that approvals and payments followed the controls                            | A tamper-evident trail they can read and export                                                          |
| System administrator | Keeps the systems and Navision running                                                              | Configuration without code, health checks and logs, and no power to approve or pay                       |

## Persona sketches

Four of the roles carry the sales pilot, so they get a fuller sketch. The others follow when T-6 has met the people.

### Priya, Support

- **Day:** starts with a full inbox of POs, remittances and vendor PIs. Spends most of the morning keying POs into Navision, line by line, then making PIs.
- **Goal:** get every order out correctly, without being the person everyone asks.
- **Frustrations:** typing the same part number three times; customers asking for status she has to find out from others; finding a mistake after the PI has gone.
- **What OrderPilot gives her:** the PO read for her, with two or three fields to confirm; a PI draft; one list of what waits on her; a status she can quote.
- **Quote, to test:** "I don't mind checking. I mind typing."

### Daniel, Product Manager

- **Day:** follows his brands' stock and orders across spreadsheets and Navision. Raises SPRs when a sale needs stock, then waits.
- **Goal:** keep his brands in stock without overbuying, and never lose a sale to a slow approval.
- **Frustrations:** not knowing whether Janet has seen an SPR; seeing other brands' noise.
- **What OrderPilot gives him:** a shortfall that suggests an SPR; one button to raise it; its approval status without asking; his brands only (Q-17).

### Janet, the approver

- **Day:** approves SPRs and requests between other work, from emails that each need context.
- **Goal:** approve quickly, and never approve something wrong.
- **Frustrations:** requests that arrive without the documents or the stock picture; reminders from several people about the same request.
- **What OrderPilot gives the approver:** every request arriving already checked, with its documents attached; only what is within the approval limit; one reminder, not five; a substitute during absences (Q-6).

### Ahmad, Warehouse

- **Day:** packs orders when told they are paid, and counts incoming goods against paperwork on a clipboard.
- **Goal:** ship the right goods, once.
- **Frustrations:** packing an order that turns out to be unpaid; a packing list that does not match the PO, found at the dock.
- **What OrderPilot gives him:** a packing task that appears only after Finance confirms payment; the PO and packing list side by side, with the difference highlighted; a tablet screen with large targets.

## What we still need to learn

- How many people work in each group, and whether one person covers several roles.
- Which step each persona would fix first.
- How they work today: email, Navision screens, spreadsheets or paper.

These are in [the questions for the client](../client/questions-for-client.md), and T-6 updates the sketches after the briefing call.
