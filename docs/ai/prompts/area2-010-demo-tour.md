# Area 2, prompt 010: a guided demo tour of the sales flow

No story of area 2 owns this. It is the demo half of area 1's backlog story E-5 (issue 77, "a first-run guided tour for each role ... it helps the demo"), built for the proposal demo, so Richie reviews it. Azri's prompts are quoted as typed, and the rest is summarised.

```text
are you able to create a "guide tutorial" in which you can start the tutorial and then a light guides you on which buttons to press for the sample data so that we can demo to the teacher easily
```

Asked how much to cover and what to do with the data afterwards, Azri chose the whole sales flow, and undoing everything at the end.

## What the AI built

"Start the demo tour", at the foot of the Demo role menu, starts it. Sixteen steps walk the sales flow: the order's nine steps on Home, Support reviewing a PO and the order's journey, the product manager raising an SPR, the approver refused without a comment and then approving with one, the history, Support sending the PI, Finance confirming the payment, the warehouse packing, Logistics adding the air waybill, and the reminders. A glowing ring lights the one button to press, and a card says what it shows and what to say. The presenter clicks the real button, or presses Next where there is nothing to click. Home's task buttons gained their task's kind and id, which the tour finds them by; the rest it finds by their headings.

```text
okay dont dim the pages. and when switching between roles, ask the person to switch between roles. this is so that the teacher is able to be exposed to each page's look alongside being guided with the buttons without the buttons being the only thing visible/highlighted throughout the tour
```

The first version dimmed the page around the button and signed in as each role by itself. Now nothing dims, and before another team's step the tour lights Demo role and asks the presenter to switch; it carries on as soon as they do.

## What the AI found that shaped it

- Sign-ins are limited to 20 a minute. Undoing everything at the end signed in once more per team and ran into the limit, so each team's actions now go back when the tour leaves that team for the last time, while it is still signed in as it. The approval waits for the end, when the tour is the approver again.
- An undo sent while its action was still being saved was refused as "already being recorded", so the tour waits until no save is in flight.
- After a role switch the open page kept the old role's data: the tour resets the queries, so the page fetches again.
- Run end to end in the browser, the way a presenter would, including the eight role switches: all 24 cards in order, every undo answered 200, and the approver's tasks were 10 before and after.
