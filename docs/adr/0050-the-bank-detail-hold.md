# ADR 0050: The bank-detail hold

- **Status:** Accepted
- **Date:** 2026-11-10
- **Story:** F-5

## Context

A vendor PI that carries changed bank details can send a payment to the wrong account, by mistake or by fraud (R-02 in [GRS by design](../grs/grs-by-design.md)). F-3 built the policy as a chain of rules ([ADR 0041](0041-the-authorisation-policy-with-approval-limits.md)), and F-4 added segregation of duties as configuration ([ADR 0044](0044-no-self-approval-and-segregation-of-duties.md)). F-5 is the control itself. Spectra has not yet said where bank details are kept or who may change them (Q-15), or how many people work in Finance (Q-49), so the rules below are configuration until it does.

## Decision

1. **No full number is ever stored or logged.** `BankDetails` holds a full number in memory only, in private fields, and every way of printing it is redacted. `seal` is the only way out, and gives a fingerprint and a last-four mask per field. Fewer than eight characters shows nothing, because four of them would be most of the number.
2. **The fingerprint is keyed.** HMAC-SHA-256 with `BANK_FINGERPRINT_KEY`, per field. A plain hash would not do: an account number is short enough to guess from its hash. The key has its own setting, because rotating the JWT secret must not make every vendor look changed. Without a key every fingerprint is random, so nothing can match: every report opens a hold, no stored details are recorded, and the API logs one warning at startup. The setting arrives in its own small pull request, because its four files are shared. Until `GovernanceModule` reads it, the module holds no key and tests inject one.
3. **What is stored moves only with two people.** `VendorBankBaseline` starts from the vendor's record (`recordBaseline`, from the seed and P-20) and changes only when a hold is cleared with the new details accepted. A PI can never set or move it.
4. **Every source goes the same way.** `reportDetails` takes a vendor PI, a vendor invoice or a vendor record edit, and matches on the vendor's Business Central number. Spaces, hyphens, dots and case are ignored, an eight-character SWIFT code equals its `XXX` form, and leading zeros count. A document is compared on the fields it carries, because not printing a field has not changed it. A record edit is compared on all of them, so a removed field is a difference. With nothing stored, every field carried is a difference.
5. **A hold is per vendor, and blocks everyone.** Several can be open at once, one per set of new details, and all must close before that vendor can be paid. A partial unique index holds that in the table, and a per-vendor advisory lock makes reports take turns.
6. **Two new rules in the chain:**

   | #   | Rule                               | Why it sits here                                                                                                      |
   | --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
   | 1   | `system-admin`                     | Unchanged                                                                                                             |
   | 2   | `permission`                       | A role without the right never learns of a hold from its refusal                                                      |
   | 3   | **`bank-detail-hold`**             | It binds everyone who could pay, so it comes before the rules about one person, and the refusal always names the hold |
   | 4-5 | `no-self-approval`, `own-setup`    | Unchanged                                                                                                             |
   | 6   | `segregation-of-duties`            | F-4's rule, with new rows only                                                                                        |
   | 7   | **`hold-verification`**            | Who the actor is comes before the state of the hold                                                                   |
   | 8-9 | `approval-route`, `approval-limit` | Unchanged                                                                                                             |

   `bank-detail-hold` stops `vendor-payment.approve` and `vendor-payment.release`, and refuses a payment that names no vendor.

7. **Two people, through F-4's rule.** `SEGREGATED_DUTIES` gains two rows: whoever changed the details (`vendor-bank.change`) cannot `payment-hold.verify`, and whoever verified cannot `payment-hold.clear`. `decide()` fills both people from area 4's own tables, so a caller cannot name someone else. After a hold closes, its changer stays barred from paying that vendor, until a later change replaces them.
8. **The second approver holds `approvals.decide`.** This changes `payment-hold.clear` from `payments.confirm`, which [ADR 0044](0044-no-self-approval-and-segregation-of-duties.md) set. Finance verifies and a management approver clears, so a hold always passes through two roles.
9. **A verification records** who (from the session), when, the outcome, and that the contact came from the stored record, with a reason. A confirmation needs that last attestation, and its contact must fall between the hold opening and now. A rejection does not need it, because a rejection only keeps the hold. The latest verification decides what may happen next.
10. **Two ways to close a hold, both needing the second approver.** `accept-new-details` follows a confirmed verification and moves the stored details. `keep-stored-details` follows a rejected one, leaves the stored details alone, and is recorded as **"suspected fraud: details rejected"**. Without it, the only way out of a forged PI would be to confirm the forged details.
11. **A refusal stays F-1's generic 403.** The reason and the hold ID go in `decide()` and the audit row only. A screen shows a hold through `openHoldsFor` or the routes.
12. **The audit trail shows before and after, masked to the last four,** as `{ from, to }` per differing field, so the audit viewer shows them as a change. In the viewer the last four are for the auditor only. On a hold they are for Finance, the approvers, Management and the auditor; everyone else who can read a hold sees which field differs, and the reason for the mask.
13. **Free text cannot carry a number.** A reason with a long run of digits or something shaped like an IBAN is refused, and the refusal does not repeat it. A refused reason, whether blank, missing or carrying a number, stays a 400 that names the field, and is audited under the rule `hold-reason` without its text, so that every refusal on a hold leaves a row.
14. **A hold says when it cannot move.** If nobody except the person who changed the details could verify it, the hold shows "needs a different Finance user". It is worked out when read, so adding or enabling a Finance user frees it.

## Alternatives considered

- **Comparing with the live record each time.** Rejected: an edit made in Business Central would change the record itself, and nothing would be left to compare it with.
- **One open hold per vendor, updated by each new set of details.** Rejected: what was verified could change underneath the second approver.
- **Deriving the key from `JWT_SECRET`.** Rejected: rotating a session secret would put every vendor on hold.
- **Returning the hold ID in the 403.** Rejected: F-1's envelope tells a caller nothing about the rules.

## Consequences

- **Nothing real calls it yet.** Area 1 needs to call `reportDetails` from vendor PI confirmation and P-68's port, and `recordBaseline` from P-20. Area 2 and P-104 need to call `enforce` with the stored `vendorNo`. E2E #4 waits for the vendor PI.
- **`payments.post` is held by no role by default,** so vendor payments are refused for everyone until P-104's permission is decided.
- **No event is emitted.** There is no bus yet (P-15), so `payment.holdRaised` and `payment.holdCleared` wait. The audit trail records both. The guides say `payment.held`, and the shared contract says `payment.holdRaised`.
- **Business Central keeps the old details** after a PI's new ones are accepted, until someone changes them there. OrderPilot does not write them back.
- **The pair `vendor-payment.approve` against `payment-hold.clear`** has nothing to feed it until vendor payments exist.
- **If the only Finance user made the change, nobody can verify it.** The hold says so, and Q-49 asks Spectra.
- **Changing the key makes every vendor's details look changed.** Set it once.
