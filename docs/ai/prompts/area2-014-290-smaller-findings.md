# Area 2, prompt 014: #290's smaller findings

Issue #290 listed six smaller findings beside its hand-overs. Asked what to work on next, Azri chose these. Azri's prompt is quoted as typed, and the rest is summarised.

```text
alright lets work on the next thing
```

## What the AI found on main

- **Already fixed:**
  - Home's one-click payment Confirm (finding 4): a payment now opens its form.
  - Support refused on the SPR page (7): Support holds `spr.read`.
  - The inbox picker (9): Richie's #348.
- **Still there:**
  - Two pages for one order (5).
  - One task worded two ways (6).
  - Cramped warehouse rows (8).

## What the AI changed

- **One task, one wording.** My tasks words a task as Home does (`needs.kind`), not with the sample data's own title. An SPR task's button says "Review", and a payment's "Enter payment details", as on Home.
- **One page for an order.** My tasks, the reminders, the notices sent to you and the SPR page open the order's own page through Home's `useOrderLinks`, which sends a role without Orders to the nearest page it may open. A payment task still opens the steps page, where the payment form is.
- **The warehouse's rows.** The tablet layout now leads with the customer, as at a desk, with bigger text and 44 px targets, and the action beside the row on a wider screen. At 1366 x 768 four tasks fit on the screen, where #290 counted two.

## Not done here

The two pages still draw the order's steps from two models: the order page from the client's own nine steps, the steps page from area 2's state machine. Merging them is a design decision for the lead.
