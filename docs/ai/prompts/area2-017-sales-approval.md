# Area 2, prompt 017: the sales approval switch

Issue #251's point 9: "Sales has no approval step today. Keep the capability, off by default." Azri asked for #251's remaining points and chose this one. Azri's prompt is quoted as typed, and the rest is summarised.

```text
lets do 251
```

## What the AI found

- Area 4's policy already had a placeholder action for it, `sales-order.approve` against the sales limit (A-19).
- An approval needs to know who raised the order, so the requester never approves their own. Orders entered through the order form record a creator, but they do not start a workflow yet; the seeded orders the machine runs record nobody. Asked, Azri chose to refuse such an order rather than invent who raised it.

## What the AI built

- **The setting.** `SALES_APPROVAL=off|on`, off by default, in the config and `.env.example`; it sets the state machine's `salesApprovalRequired` rule.
- **The state machine.** `SALES_APPROVED` and `SALES_APPROVAL_UNDONE` keep the order where it is and record the approval and its approver. While the rule is on, `PI_SENT` waits for it, and the order waits on the approvers.
- **Who raised it.** Starting an order's workflow records the person who started it (`raisedByUserId`) and its total when given.
- **The decision.** `decideSale` asks area 4's policy (`sales-order.approve`), like `decideSpr`. `SalesApprovalService` refuses an order the machine does not run, one whose raiser is unknown, and the raiser; only the approver may undo. Every refusal is audited. Two routes, under `approvals.decide`.

## What the AI found that shaped it

- Each state machine test case can now carry a machine with other rules, so the two new events, which only the rule allows, are checked against every status like the rest.
- One deliberate break first did not apply, because the formatter had laid the line out differently; it was redone against the real text. All three (no requester check, no decider check, no PI gate) were caught.

## Not done here

A screen for it, once Spectra says what a sales approval is. The order form starting a workflow, which would give its orders a raiser.
