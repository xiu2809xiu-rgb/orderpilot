# Area 2, prompt 016: the PI sent, and reverse and reissue

Issue #251's point 6: "An issued PI or invoice is fixed only by reverse and reissue: a credit note, then a new invoice", with a reason and an audit entry. Nothing issued a PI on the orders the state machine runs, so there was nothing to reverse. Asked, Azri chose to put Support's Send the PI on the machine first, then the reissue, built on #346's branch. Azri's prompt was the answer to that question; the rest is summarised.

## What the AI built

- **Send the PI moves the order.** `PiIssueService.send` is `PI_SENT`: the PI's record is marked sent, and the next team gets its task, Finance's when a prepayment is due, else the warehouse's.
- **Undo, for a mistaken click.** `PI_SEND_UNDONE` goes back to the stock check, or to the approved SPR of a short order, only while no payment is kept and nothing is packed.
- **Reverse and reissue.** `POST /workflows/orders/:orderNo/pi/reissue` with a reason (`orders.edit`): the issue number goes up, and the reason, who and when are kept on the PI's record and audited. It is allowed while the order waits for a payment none has been confirmed against. Once reissued, the PI was really sent, so the mistaken-send undo no longer applies.
- **Packing's undo** now goes back to waiting for payment when no prepayment was due, instead of being refused.
- **The steps page** shows the PI, its issue and every reversal, and asks why before reversing, saying it cannot be undone.
- **The seed** runs the four PI-to-send orders with no prepayment and enough stock.

## What the AI found that shaped it

- The task-event writer records every event as the system's, which would misattribute a person's reissue. So the order's history reads reversals from the PI's record, and the audit trail keeps who did it.
- Only four sample orders qualify, so the tests put an order back before each test rather than use one up.
- The generated mock now fills the flow's optional `pi` at random, so the order page test sets it.
- Three safeguards broken on purpose (a reissue after a payment, an undo after a reissue, no warehouse task) were each caught.

## Not done here

The invoice's credit note, until invoicing exists. The short-stock hold (point 4) waits for Richie's answer on #251.
