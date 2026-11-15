# ADR 0049: The SPR process the client described

- **Status:** Accepted for the words and the personas. The three conflicts below were ruled on by Angelyn in [ADR 0055](0055-the-approver-group-replaces-the-approval-chain.md).
- **Date:** 2026-11-09
- **Story:** P-84

## Context

At the briefing of 5 Nov 2026 Spectra described its purchasing in its own terms. Our first reading was a guess from the brief: an SPR was a Sales Purchase Requisition, raised when an order found stock short, and one approver decided it, with a substitute while they were away. Parts of that are wrong, and the repository says it in many places: `CLAUDE.md`, the problem statement, the data formats, the hero journey and the workflow code.

This ADR records what we now know and what it changes in our words. It changes no logic of areas 2, 3 or 4. Those areas own their code and their tests, and each has an issue (#251 for area 2, #252 for area 4, #253 for area 3) that lists what follows from these facts.

## Decision

1. **SPR means Stock Purchase Requisition.** The product manager raises it, from stock on hand and the last three months' run rate. At Spectra the product manager and the purchase manager are the same person. It is not raised from one order's shortfall.
2. **Spectra sells only what it has.** When a PO asks for more than is available, the order is held and the customer is asked to revise the PO to the available quantity at the PO's price. The revised PO is version 2 of the same order. There are no partial shipments or back orders by default. A short order therefore raises no SPR.
3. **A coordinator routes each SPR.** The coordinator is a Support user. They send it to the management approver group, which has three people. Any one of them decides, so the process needs no substitute. If no one has decided after 24 hours, the whole group gets a reminder asking them to approve or to reply with remarks. After approval the coordinator hands the SPR back, and the product manager places the vendor PO, or records the vendor portal's reference where the vendor makes Spectra enter POs there.
4. **The product manager sees where an SPR is stuck.** Its page says who holds it and for how long.
5. **Approval limits stay a switch, and none is set.** The capability stays, and an approver group with no limits is the default. Sales has no approval step today, because one person buys and sells each product line, so a sales approval stays switched off by default.
6. **Zero tolerance on four fields.** Part number, quantity, unit price and currency must match exactly across the PO, PI, invoice and packing list. There is no tolerance setting for those four. Other differences are warnings. The customer and the vendor are never the mismatch. The PO's price is the agreed price, and the check is that the documents agree.
7. **Our wording of the client.** Spectra's customers are in South Asia, the Middle East and South-East Asia, and payment terms vary: some pay before shipment and some pay on credit terms. `CLAUDE.md` and the problem statement say so.
8. **The personas.** The approver demo persona is Rachel Goh, made up. The other two approvers are Marcus Teo and Farah Ismail, and the coordinator is Michelle Lau, a Support user. All four are invented for the demo, and none is a person at Spectra. The first persona's real first name leaves every text file except prompt 001, which is history.
9. **The role keeps its stored value.** `APPROVER` stays in the database and the wire. Its label reads "Management approver".
10. **End-to-end test #1 keeps its steps** for `v0.1-proposal`. Its fourth step still reads "pre-filled from the shortfall". With P-61 the pre-fill moves to stock on hand and the run rate, and P-90 records the switch in the hero journey after the tag.

## Conflicts with ADR 0041, for Angelyn to decide

[ADR 0041](0041-the-authorisation-policy-with-approval-limits.md) built the policy for the first reading. Three of its decisions no longer fit the process above. This ADR rules on none of them, and the code is unchanged.

- **Decision 6, who may decide.** The rule `approval-route` sends a request to the requester's Approver ID, then to a substitute while they are away, then to the absent approver's own Approver ID. The process has no substitute and no escalation by absence: any one of three approvers decides. Whether the rule becomes "any member of the group" and what happens to `awayFrom` and `awayUntil` is hers to decide.
- **Decision 8, a substitute uses their own limit.** With no substitute the setting has nothing to decide. Whether the setting and its test are removed is hers to decide.
- **Decision 10, the seed.** The sample chain has one approver with 20,000.00 for sales and 5,000.00 for purchases, escalating to Management, and no substitute. The process has three approvers and no limit set. Whether the seed changes, and what Management's role becomes when limits are off, is hers to decide.

Decision 7, the limit rule, stays. Limits are switchable, with none set, and the rule applies only when they are on.

## Alternatives considered

- **Renaming the `APPROVER` role.** Rejected: the value is stored and read by every area. Only its label changes.
- **Ruling on ADR 0041 here.** Rejected: the policy is area 4's, and the decision belongs to its owner after she has read the facts.
- **Editing the hero journey's steps now.** Rejected: the proposal release shows the sales pilot as built. P-90 switches the steps after the tag.

## Consequences

- `CLAUDE.md`, the problem statement, the data formats and the hero journey say the above. Until areas 2 and 4 change their code, the workflow still has one approver with a substitute and still raises an SPR from an order. The docs say so wherever they describe the new process.
- Area 2 (#251), area 4 (#252) and area 3 (#253) each list the changes their code and tests need. Nothing here edits their files except a persona's name where a test names it.
- Later commits of this story rename the demo approver, and the seed then updates the display name of an existing demo account on the next `pnpm db:seed`. The other three personas are seeded by P-86.
  - _Note, 2026-11-10 (P-86, [ADR 0051](0051-real-brands-in-the-synthetic-data.md)):_ by default P-86 adds the other three as data only, in the team list, with no login accounts. Whether they become accounts is open for Richie.
