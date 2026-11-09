# Questions for the client

For the briefing call with Spectra Innovations (T-2, Sprint 2, the week of 2 Nov 2026). Each answer confirms or changes an entry in [the assumptions](../assumptions.md), and the person who records it updates that entry in the same pull request.

> **Send the priority questions first.** Email the three requests and the priority questions (Q-1 to Q-12) to Spectra in writing a few days before the call, so that the right people join it and can bring answers. The call then covers the rest.

When an answer arrives:

- record it here in our own words, with the date and who gave it;
- never paste Spectra's documents, figures or screenshots into this file, an issue or an AI tool;
- label any issue that waits on an answer `status: needs client input` (planned: P-2).

## The briefing call

Held in the week of 2 Nov 2026, with Spectra's representative. The team's minutes stay outside this repository. [What the briefing said](../assumptions.md#what-the-briefing-said) records the answers in our own words. **Answered in part:** Q-1, Q-2, Q-3, Q-6, Q-7, Q-8, Q-11, Q-14 and Q-18. **Not answered:** every other question above Q-25, including the three requests for samples, an export and a timeline.

**Not asked yet.** To send to Spectra in writing, in order of how much they change what is built:

| #    | Question                                                                                                                                                                                    | Why it matters                                                      | Assumptions |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------- |
| Q-25 | When a customer's order is short of stock and they want the full quantity, is an SPR ever raised for that order? Or are SPRs raised only when purchasing for stock?                         | Our sales flow holds an order at an SPR when stock is short         | A-21        |
| Q-26 | When you say amendments and new customer cards go back into Microsoft Dynamics 365 Business Central, must OrderPilot write them itself? May it do so only after a person approves each one? | We read and staff post, and AI never posts. This is the largest gap | A-12        |
| Q-27 | Your first priority names sales and purchases. If the proof of concept can finish only one properly by February, which one?                                                                 | Sets the Must list                                                  | A-20        |
| Q-28 | Of the three approvers, must one, most or all approve an SPR? What if they disagree? Do any limits apply? Who decides while they are away, and what does the facilitator check?             | We built one approver with a limit, then a chain above it           | A-23, A-24  |
| Q-29 | Who is the management team that gets the 24-hour reminder: the three approvers, or others? Does it repeat? May a demo send real email? Do other tasks need reminders too?                   | Sets the reminder's recipient, and whether we build email           | A-33, A-37  |
| Q-30 | "Return remarks if clarification is needed": does that send the SPR back to be corrected, or only ask a question while it stays open?                                                       | We have approve and reject. This may be a third outcome             | A-23        |
| Q-31 | "100% accurate" with no tolerance: is a person confirming every extracted field acceptable, given that no AI reads perfectly?                                                               | The brief and our design keep a person in the loop, for this reason | A-26        |
| Q-32 | May we have your written permission to use a cloud AI service on your documents, in which region? Which information is off-limits?                                                          | No restrictions were raised, but our rules need this in writing     | Q-12        |

## Ask for these first

1. **Samples of every document type,** with names, prices and bank details blacked out: five to ten each of customer POs, PIs, invoices, packing lists, AWB/BL, import permits, vendor PIs and **the SPR form**, with normal and messy cases. They go to `samples/` on one machine, never into Git ([how to try a sample safely](../data-formats.md#trying-a-client-sample-safely)).
2. **An export from Business Central** of the item, customer and vendor lists, or just its column headings if the values cannot leave Spectra.
3. **The timeline of one real order,** from the PO arriving to the AWB/BL closing: each step, who did it, and how long it waited.

## Priority questions

In priority order. The first few shape the design most.

| #    | Question                                                                                                                                                                                                 | Why we ask                                          | Assumptions                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| Q-1  | Which Business Central version do you run, cloud or on-premise, and how customised? Does it publish web services (SOAP or OData), or do you export files? Is there a test company we could work against? | Decides how the connector reads Business Central    | A-02, A-06, A-10 to A-12, A-17, A-18, A-30 |
| Q-2  | How do documents arrive (one mailbox, several, uploads, a portal), in which formats and languages, and how many a month? How many different layouts do customers and vendors use?                        | Sizes intake and layout mapping                     | A-03 to A-05, A-34                         |
| Q-3  | Which flow should the pilot cover: sales, purchasing, or both? Which step wastes the most time today?                                                                                                    | Sets the Must list                                  | A-20                                       |
| Q-4  | When does the PI go to the customer, and when to the warehouse?                                                                                                                                          | You flagged this sequence yourselves                | A-22                                       |
| Q-5  | When is an SPR raised in a sale: for every sale, only on a shortfall, or only for items outside your usual range?                                                                                        | The SPR trigger is an open rule                     | A-21                                       |
| Q-6  | Who approves what, up to which limit? Who decides while the approver is away?                                                                                                                            | Approvals, limits and delegation are open rules     | A-23, A-24                                 |
| Q-7  | What are today's baselines for your five measures, and which errors cost you most?                                                                                                                       | Without baselines the measures stay lab estimates   | None yet                                   |
| Q-8  | When do two documents count as disagreeing (how much price difference is acceptable, and what about partial shipments or substituted items), and who handles it then?                                    | Sets the check rules and the exceptions flow        | A-26                                       |
| Q-9  | How is a customer's payment confirmed, in which currencies, and must every order be paid before it ships? How are vendor payments scheduled, and how are vendors' bank details checked today?            | Shapes the payment gate and the bank-detail control | A-01, A-25                                 |
| Q-10 | Which forwarders do you use, what do their AWB/BL look like, and which import permits does each destination country need?                                                                                | Shapes the follow-ups                               | A-27                                       |
| Q-11 | Where do your teams work (email, Outlook, Teams, WhatsApp, Excel)? May OrderPilot send messages itself, or only draft them?                                                                              | Shapes notifications                                | A-33                                       |
| Q-12 | May we use an AI service on your documents, and in which region? Are bank details, prices or customer contacts off-limits to it? Is hosting in Singapore acceptable?                                     | Decides what AI may see                             | A-31, A-32, A-35                           |

## From our Business Central notes

Questions that came out of [the domain notes](../research/domain-notes.md), about standard Business Central. Each one checks something we assumed from the standard product.

| #    | Question                                                                                                                                                     | Assumptions |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Q-13 | Is the PI a pro forma printed from the Business Central sales order, or a posted prepayment invoice? Is the customer's payment recorded in Business Central? | A-13        |
| Q-14 | Are approval limits and approvers already set up in Business Central, or kept outside it?                                                                    | A-14        |
| Q-15 | Where are vendors' bank details kept, and who may change them?                                                                                               | A-15        |
| Q-16 | Do you record forwarders and AWB/BL numbers in Business Central (Shipping Agent, Package Tracking No.)?                                                      | A-16        |
| Q-17 | Does each Product Manager own certain brands, and should they see only those orders?                                                                         | A-28        |
| Q-18 | How are returns and credit notes handled, for customers and for vendors?                                                                                     | A-29        |

## For the call

| #    | Question                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------ |
| Q-19 | Who on your side accepts the results and agrees the success measures?                                                    |
| Q-20 | Could one or two of your staff try the prototype, for example from Support and the warehouse?                            |
| Q-21 | Which number series does Business Central use for each document? We would show Business Central's numbers beside our own |
| Q-22 | How long must order records, documents and approvals be kept?                                                            |
| Q-23 | May we show your name or logo in the demo, or should it stay unbranded?                                                  |
| Q-24 | Which product categories and part-number formats are typical, so that our synthetic catalogue looks right?               |

## Answers

None yet. Record each answer here: the question, the date, who answered, and the answer in our own words.

| #   | Date | From | Answer |
| --- | ---- | ---- | ------ |
