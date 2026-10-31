# Success metrics

How we will know OrderPilot helps, and how we measure it. Spectra's five measures come first. The brief gives no baselines, so **each one is a lab estimate on synthetic data** until Spectra gives real numbers (Q-7). Our own targets, each with a test, are in [the problem statement](../problem-statement.md#7-success-metrics).

## Spectra's five measures

| Measure                  | Definition                                                         | Source in OrderPilot                                           | Lab estimate                                 | Spectra's baseline |
| ------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------- | ------------------ |
| Order-processing time    | Minutes of staff work per step, from PO received to goods released | The order's workflow events and the protocol's stopwatch times | From the protocol, manual against OrderPilot | To ask (Q-7)       |
| Manual touches per order | Hand-typed or hand-corrected fields, plus hand-offs between groups | Field edits on the review screen, and task hand-offs           | From the protocol                            | To ask             |
| Data-entry errors        | Confirmed values that differ from the truth, per 100 fields        | The ground truth of the synthetic documents (planned: P-21)    | From the protocol                            | To ask             |
| Approval turnaround      | Hours between an SPR being raised and decided                      | The SPR's workflow events                                      | Only meaningful with real users              | To ask             |
| Overdue orders           | Orders late on any step, counted by step and owner                 | The tracker's overdue flags                                    | Counted on the synthetic orders              | Not visible today  |

Approval turnaround and overdue orders depend on how people behave over days, so the lab can only show that OrderPilot measures them. Their real values need Spectra's staff.

## The measurement protocol

The same work done two ways, by hand and with OrderPilot, timed and counted the same way.

### What we measure

- **Time:** the minutes a person spends on each step, from opening the task to finishing it, measured with a stopwatch in both runs. In OrderPilot runs, the workflow events give a second, automatic measure.
- **Touches:** every field the person types or corrects, and every hand-off to another person or group.
- **Errors:** every field that differs from the ground truth once the person says it is done.

### The material

- A set of 10 synthetic sales orders, each with its PO, packing list and invoice, from the synthetic documents (planned: P-21). At least two POs in a layout the tester has not seen, and the seeded mistakes left in.
- **The manual run** uses a spreadsheet laid out like Navision's sales order (Sell-to Customer No., External Document No., the lines) and the documents as PDFs, as Spectra's staff work today.
- **The OrderPilot run** uses the same documents, uploaded into the demo stack with the mock AI provider, or a provider allowed for synthetic data.

### The steps

1. **Testers:** at least three people who did not build the step being measured. Each does half the orders by hand first and half with OrderPilot first, so that learning the documents does not favour one side.
2. **Brief:** each tester gets the same written instructions and five minutes of practice on one order that is not measured.
3. **Run:** for each order, enter the PO, check stock, raise an SPR where stock is short, and check the packing list against the PO. An observer records the times, touches and hand-offs on a sheet.
4. **Score:** compare every entered field with the ground truth, and count the errors and the seeded mismatches found.
5. **Report:** the median and the range for each measure, by hand against OrderPilot, with the number of testers and orders. No averages without the range.
6. **Repeat** at each release (Weeks 5, 13 and 18), and with Spectra's staff if they agree (Q-20).

### Keeping it honest

- Synthetic data only. No Spectra document is used unless Spectra agrees, and then only on the throwaway stack ([trying a client sample safely](../data-formats.md#trying-a-client-sample-safely)).
- The protocol and the scoring sheet are fixed before a run, and any change is recorded with its reason.
- Results go in the table below whether they are good or bad. A lab estimate is always labelled as one.

## Results

| Date | Release | Testers | Orders | Measure | By hand | With OrderPilot | Notes |
| ---- | ------- | ------- | ------ | ------- | ------- | --------------- | ----- |

No run yet. The first is planned before the Week 5 proposal, once E2E #1 works.
