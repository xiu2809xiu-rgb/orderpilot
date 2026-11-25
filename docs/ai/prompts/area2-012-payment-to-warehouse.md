# Area 2, prompt 012: a confirmed payment reaches the warehouse

Issue #290 found that a payment Finance confirmed never reached the warehouse, and that an order's flow named a different team from its open task. After the SPR thread (prompt 011), Azri asked what else could be done and chose this. Azri's prompt is quoted as typed, and the rest is summarised.

```text
are we able to work on anything else?
```

## What the AI built

- **Payments are stored.** On an order the state machine runs, Finance's confirmation is kept in the database's `PaymentConfirmation` table, which existed but was unused, and audited. Sample orders keep theirs in the mock overlay as before.
- **The gate opens the warehouse's task.** Once the prepayments and full payments confirmed so far cover the prepayment due, the order moves to Paid, Finance's task closes and the warehouse gets "Pick and pack the order", in one commit. A smaller payment is kept and the order waits.
- **Undo, both ways.** Two new transitions: `PAYMENT_UNDONE` takes the order back to Finance until packing starts, and `PACKING_UNDONE` takes a packed order back to Paid.
- **Packing moves the order.** The warehouse's Pack task is now `PACKING_STARTED`, which leaves the order with Support to invoice.
- **One answer to "who has it".** A running order's flow takes its current step and owner from the machine, so a short order names the product manager, as its Raise task does.
- **The seed** runs the twelve orders waiting for a prepayment. The two that expect only a deposit stay samples, because a deposit never opens the gate.

## What the AI found that shaped it

- Payments never touched the state machine: the mock overlay kept them in memory, so the order's status could not move, and a restart forgot them.
- The machine had no way back from Paid or Packing, so Undo needed its own transitions, each refused once the next team has started.
- The first Docker build failed on a generated file OneDrive had not fully written; rewriting the generated folder in place fixed it.
- Three safeguards broken on purpose (no Pack task, an undo that left it open, a flow that ignored the machine's owner) were each caught by the tests.

## Not done here

Support's invoice task after packing is the next hand-over. Home's one-click payment Confirm and the payment form still differ (#290 finding 4).
