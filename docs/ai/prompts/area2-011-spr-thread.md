# Area 2, prompt 011: the SPR thread

Issue #251 lists what the SPR still lacks, and #290's first finding is that raising an SPR moved nothing. Asked which part to build first, Azri chose the SPR thread: points 2 and 8 of #251 plus #290's first finding. Azri's prompt is quoted as typed, and the rest is summarised.

```text
okay lets do 251
```

## What the AI built

- **Raise sends it.** On an order the state machine runs, the product manager's Raise task moves the order to `AwaitingSpr`, gives the SPR its record and opens the approvers' task, in one commit. Undo takes it back while nobody has decided it, through a new transition, `SPR_RAISE_WITHDRAWN`.
- **Any one approver decides.** A second decision is refused, as before.
- **The decision hands it back.** An approval opens the product manager's new task, Place the vendor PO. A rejection reopens Raise, so the SPR is corrected and raised again. Undoing the decision closes whichever task it opened.
- **The SPR page says where it stands.** A suggested SPR reads "Not raised yet", with a Raise button for the product manager and a plain sentence for everyone else; a rejected one offers Raise it again.
- **The seed** puts the short orders whose SPR is only suggested on the machine at `StockChecked`, so the demo can walk the whole thread.

## What the AI found that shaped it

- The task lists come from the daily synthetic dataset, so the new tasks are stored rows shown beside it, and a sample task hides once its stored row is closed.
- The first integration run failed because a task of the wrong kind answered 404 before 409; the checks now run role, then kind, then whether it is open.
- An undo of a decision left its hand-back task hidden but still open in the database. The test now reads the stored row, and three safeguards broken on purpose were each caught.
- Undoing a task answered "Recorded. The order has moved on."; it now says "Undone. The task is open again."

## Not done here

The approvers are still one Approver inbox with the substitute chain. When Angelyn's approver group (#327) merges, a follow-up swaps the chain for its `approversFor`.
