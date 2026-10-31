# Hero journey

The story the demo tells, and the four end-to-end tests that prove it. Each area presents the part it built, because each member is marked on their own work.

Nothing here runs yet. Each step names the story that brings it, and the end-to-end tests run in Playwright with axe from P-14 on.

## The story

A synthetic customer in Colombo emails a PO for three lines of IT peripherals. Today, Support would re-type it into Navision, check stock by hand, chase the approver for an SPR, compare the packing list by eye and answer "where is my order?" by asking around.

With OrderPilot, the PO is read once. A person confirms the two fields the AI is unsure of. Stock is checked in mock Navision, one line is short, and an SPR is raised with a button and approved within the approver's limit. A task left waiting gets a reminder. When the packing list arrives with the wrong quantity on one line, OrderPilot flags it before anything ships. The tracker shows the order's status, who holds it, its history and the exception, and every action is in the audit trail.

All data in the demo is synthetic and labelled "Synthetic demo data". Mock Navision and the mock AI provider are labelled "Mock" and "Mock AI".

## E2E #1: the sales pilot

The Must list, for the Week 4 prototype and the Week 5 proposal. It grows as each Should item lands.

| Step | Who             | What happens                                                                                  | What it shows                                                      | Area | Built in                     |
| ---- | --------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- | ---------------------------- |
| 1    | Support         | Uploads the customer's PO. OrderPilot classifies it as a PO and extracts its fields           | AI reads, with a confidence score and a source link for each field | 1    | P-17, P-18, area 1's stories |
| 2    | Support         | Confirms two low-confidence fields, marked "Requires approval"                                | A person confirms what the AI is unsure of                         | 1    | Area 1's review screen       |
| 3    | Support         | Sees stock for each line from mock Navision. One line is short                                | Data matched on Navision numbers, never names                      | 1    | P-19, P-20                   |
| 4    | Product Manager | Raises an SPR with a button, pre-filled from the shortfall                                    | The system suggests; a person raises                               | 2    | C-1, C-2                     |
| 5    | Approver        | Approves the SPR within their limit, with a comment. The approval is logged                   | Rules decide who may approve; people approve                       | 2, 4 | C-3, F-3                     |
| 6    | Support         | A task left waiting past its deadline gets a reminder                                         | Nobody has to chase                                                | 2    | C-4                          |
| 7    | Warehouse       | The packing list arrives with a different quantity on one line. It is flagged as an exception | Documents checked against each other by fixed rules                | 3    | D-1, D-2, D-3                |
| 8    | Management      | Opens the tracker: the order's status, owner, history and the exception, with overdue flags   | One view of every order                                            | 3    | D-1, D-4                     |
| 9    | Auditor         | Opens the audit trail for the order: every action, who did it and when, with the chain intact | Every decision is audited and tamper-evident                       | 4    | P-9, F-2                     |

As the Should items land, the journey adds: the payment gate (packing waits for Finance), the PI draft, full matching, the AWB/BL and permit follow-ups, and email intake with an update drafted by AI and sent by a person.

## E2E #2: AI layout mapping

1. Support uploads a PO in a layout OrderPilot has not seen.
2. The AI proposes a mapping of the layout's fields.
3. A person reviews and approves the mapping.
4. The next PO in that layout is read with the approved mapping, with no code change.

Area 1. Built in area 1's layout-mapping story, after P-17 and P-18.

## E2E #3: refusals

1. A role without the right calls the approval endpoint directly, bypassing the UI. The server refuses it.
2. A requester tries to approve their own SPR. Segregation of duties refuses it.
3. A role outside Finance opens a vendor's bank details and sees them masked, with the reason.
4. Each refusal and each masked view is in the audit trail.

Area 4, on area 1's permissions guard. Built in P-10, F-1, F-3 and F-4.

## E2E #4: the purchase flow (phase 2)

1. An approved SPR becomes a vendor PO draft, which a person approves.
2. The vendor's PI arrives with bank details that differ from the Vendor Bank Account on record. The payment is held until Finance and a second approver clear it.
3. The goods arrive, and the receipt is matched against the invoice, the packing list and the AWB/BL.
4. The payment-due reminder fires.

Areas 2, 3 and 4, on area 1's documents. Built in Weeks 8 to 12: F-5 brings the bank-detail hold, and the rest comes from the owners' phase 2 stories.

## Presenter slots

For the Week 5 proposal demo. Each presenter shows their own area's code and explains one decision in it. The times are a first plan, about 10 minutes in all, and T-5 fixes them.

| Slot | Presenter | Area                                 | Shows                                                                                  | Time    |
| ---- | --------- | ------------------------------------ | -------------------------------------------------------------------------------------- | ------- |
| 1    | Richie    | 1. Document AI and integration       | The problem, then steps 1 to 3: upload, extraction, the two confirmed fields and stock | 3 min   |
| 2    | Azri      | 2. Order workflows and approvals     | Steps 4 to 6: the SPR raised and approved, and the reminder                            | 2.5 min |
| 3    | Iok Teck  | 3. Checks, tracker and insights      | Steps 7 and 8: the mismatch, the exceptions queue and the tracker                      | 2.5 min |
| 4    | Angelyn   | 4. Controls, security and monitoring | Step 9 and E2E #3: a refused direct call, masking and the audit trail                  | 2 min   |

If a step is not ready by the demo, its presenter says so and shows its screens on the synthetic data, labelled as planned. A demo never pretends.
