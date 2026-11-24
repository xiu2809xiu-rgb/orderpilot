# Area 2, prompt 015: the 24-hour email port

Issue #251's point 3 asks area 2 to define the hook for Spectra's 24-hour rule: a port the sweep calls when an SPR approval has waited 24 hours, saying whom it emails and what it receives. Area 1's P-100 implements the sending. Azri chose all of #251's remaining points, and this one first. Azri's prompt is quoted as typed, and the rest is summarised.

```text
2
```

## What the AI built

- **The port.** `ApprovalOverdueNotifier` (`domain/approval-overdue-notifier.ts`), beside area 2's other ports. It receives one `OverdueApproval`: a key, the task, the order and SPR numbers, when it was due, and the approvers who may decide, each by id and name only.
- **When it is called.** When the `APPROVE_SPR` escalation goes out, which the seeded settings put at 24 hours, inside the same transaction as the notice.
- **Whom it emails.** The whole approver group from area 4's `approversFor`, never the requester. The coordinator gets no copy until Spectra says so.
- **Once.** The escalation's key goes with it, and the sweep calls it once per task. If it throws, the notice rolls back and the next sweep calls it again with the same key, so the adapter's once-per-key makes a retry send nothing twice.
- **No figures in mail.** No amount, price or contact goes through it; the email links to the SPR, where masking applies.
- **Until P-100.** `LogApprovalOverdueNotifier` logs a count and sends nothing.

## What the AI found that shaped it

- A sweep handles every open approval at once, the seeded ones included, so the tests clear the fake's record before each test and fail only the chosen task.
- Two safeguards broken on purpose (the port never called, and called after the transaction) were each caught.
