# Journey maps

The sales flow, today and with OrderPilot. Today's map is our reading of the brief; the real order timeline Spectra sends (request 3) will correct it. The purchase flow gets its maps before phase 2 (Weeks 8 to 12).

## Today: the sales flow by hand

| Step                        | Who                                | What they do                                                                      | Documents             | Pain                                                                  | Feeling    |
| --------------------------- | ---------------------------------- | --------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------- | ---------- |
| 1. The PO arrives           | Support                            | Opens the email, reads the PO, keys each line into Navision                       | Customer PO           | Re-typing every line; a typo travels to every later document          | Rushed     |
| 2. Stock check and SPR      | Support, Product Manager, approver | Checks stock, asks the Product Manager, who raises an SPR and emails the approver | SPR form              | Nobody knows who holds the SPR; the order waits                       | Uncertain  |
| 3. The PI                   | Support                            | Makes the PI from Navision with the bank details and sends it                     | PI                    | Bank details and prices copied by hand                                | Careful    |
| 4. The customer pays        | Finance, Support                   | Finance sees the money arrive and tells Support, eventually                       | Bank advice           | Packing waits for the news; the customer has already paid             | Waiting    |
| 5. The warehouse packs      | Warehouse                          | Packs from the PI                                                                 | PI                    | Not sure the order is paid; counts by hand                            | Unsure     |
| 6. Invoice and packing list | Support, Warehouse                 | Makes both, keying quantities again                                               | Invoice, packing list | A quantity that differs from the PO is found late, or by the customer | Anxious    |
| 7. To the forwarder         | Logistics                          | Books the forwarder and hands over the goods                                      | Packing list          | Shipping details re-typed for the forwarder                           | Busy       |
| 8. Shipping details         | Logistics, Support                 | Emails the customer the shipping details                                          | Email                 | The customer chases first                                             | Defensive  |
| 9. AWB/BL and permit        | Logistics                          | Chases the AWB/BL and the import permit                                           | AWB/BL, permit        | Missing papers hold goods at the border                               | Frustrated |

**Across the whole journey:** six groups, about nine hand-offs, and no shared view. Management learns how an order is going by asking.

## With OrderPilot: the sales flow

| Step                        | Who                       | What changes                                                                                                            | Rule or person in charge                  | Area    |
| --------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------- |
| 1. The PO arrives           | Support                   | Upload or email. The AI classifies and extracts it; Support confirms only the doubtful fields                           | A person confirms; AI only reads          | 1       |
| 2. Stock check and SPR      | Product Manager, approver | Stock comes from Navision through the connector. A shortfall suggests an SPR; the approver gets it with its checks done | The approval limit; a person approves     | 1, 2, 4 |
| 3. The PI                   | Support                   | A PI draft from the confirmed order, with the bank details masked by role                                               | Support reviews and sends it              | 2       |
| 4. The customer pays        | Finance                   | Finance confirms the payment in OrderPilot, and the payment gate opens                                                  | The gate rule plus Finance's confirmation | 2, 4    |
| 5. The warehouse packs      | Warehouse                 | The packing task appears only once the order is paid                                                                    | The state machine                         | 2       |
| 6. Invoice and packing list | Support, Warehouse        | The packing list is checked against the PO and invoice. A difference goes to the exceptions queue                       | Fixed check rules; a person resolves      | 3       |
| 7. To the forwarder         | Logistics                 | Shipping details come from the confirmed order, not re-typed                                                            | A person releases the goods               | 2       |
| 8. Shipping details         | Logistics, Support        | The AI drafts the customer's update; a person sends it                                                                  | A person sends                            | 1, 2    |
| 9. AWB/BL and permit        | Logistics                 | Follow-ups with deadlines, reminders and escalations; overdue ones show on the tracker                                  | Deadlines as configuration                | 2, 3    |

**Across the whole journey:** the tracker shows every order's status, owner, history and exceptions, and the audit trail records each decision. Staff still post in Navision.

## Moments that matter

The steps where OrderPilot must earn trust, so the prototype gets them right first:

1. **Step 1, the confirm screen.** If confirming takes longer than typing, Support will not use it.
2. **Step 2, the approver's view.** Janet must trust the checks enough to approve from one screen.
3. **Step 4, the payment gate.** A false "paid" ships unpaid goods; a missed "paid" delays a customer who has paid.
4. **Step 6, the mismatch.** One mismatch caught before shipping is the demo's proof.
