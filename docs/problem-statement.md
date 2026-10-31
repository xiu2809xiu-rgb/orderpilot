# Problem statement

Problem Statement #11, Spectra Innovations. Written on 31 Oct 2026, before the briefing call with Spectra (T-2, in Sprint 2). The brief is summarised here in our own words: Spectra's own documents never go into Git. Anything beyond the brief is an assumption: see [the assumptions](assumptions.md). [The questions for the client](client/questions-for-client.md) are how we will settle them.

## Contents

1. [The brief in our words](#1-the-brief-in-our-words)
2. [Stakeholders](#2-stakeholders)
3. [Pain points](#3-pain-points)
4. [Root cause](#4-root-cause)
5. [Constraints](#5-constraints)
6. [Scope](#6-scope)
7. [Success metrics](#7-success-metrics)
8. [Open questions](#8-open-questions)

## 1. The brief in our words

**Who Spectra is.** Spectra, based in Singapore, distributes computer peripherals and IT products, and holds master distribution rights for certain brands. Its buyers are mainly in India, Sri Lanka, Bangladesh, Pakistan and the Middle East, and most of them pay up front, before anything ships. Orders and stock live in Microsoft Dynamics Navision.

**What goes wrong today.** An order passes through six groups: Product Managers, the approver (Janet), Support, Warehouse, Finance and Logistics. Each group keys in data that already exists in a document someone else received: the customer's PO, the proforma invoice (PI), the invoice, the packing list and the AWB/BL. Then they chase each other for approvals, payments and shipping papers.

**The sales flow.** The customer's PO arrives. Stock is checked, and an SPR (Sales Purchase Requisition) is raised when stock is needed. Support sends a PI carrying Spectra's bank details. The customer pays. The warehouse packs. The invoice and packing list are made. The goods go to the forwarder, and the customer receives the shipping details. Last, Logistics chases the AWB/BL and the import permit.

**The purchase flow.** A Product Manager raises an SPR and the approver approves it. Support creates the vendor PO in Navision. The vendor's PI comes back with the vendor's bank details. A forwarder is arranged. The warehouse compares what arrives with its paperwork (invoice, packing list, AWB/BL), and the goods are received into Navision. The customer is told, and Finance pays the vendor on the due date.

**What the brief asks for.** A tool that pulls part numbers, quantities, prices and shipment details out of these documents; compares the documents with each other and raises disagreements for a person; sends each approval and task to the right group, with reminders; and shows every order's status, owner, open actions and exceptions in one place. It suggests starting with one flow, probably sales, while staff keep posting in Navision. Human approvals and the financial controls stay.

**Spectra's own idea.** AI handles the reading and the variety of documents; a workflow engine applies the business rules, the limits and the order of the steps. Spectra would judge success by five measures: order-processing time, manual touches per order, data-entry errors, approval turnaround and overdue orders.

**Our answer: OrderPilot.** An order-automation layer that sits beside Navision and never replaces it, under one tagline: **AI reads, rules decide, people approve.** A document is read once, a person confirms what the AI is unsure of, and the confirmed data feeds every group's tasks and one tracker. Fixed rules do the comparing and routing. People approve, release, post and pay, and every one of those actions is audited.

| Task                                                     | Approach                                              |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Reading fields from POs, PIs, invoices and packing lists | AI extraction with confidence scores and human review |
| Telling document types apart                             | AI classification                                     |
| Comparing quantities, prices and PO references           | Fixed rules                                           |
| SPR routing and limits                                   | Workflow rules; a person approves                     |
| Releasing packing after payment                          | A rule plus Finance's confirmation                    |
| Explaining an exception                                  | An AI summary; the logs stay the source of truth      |
| Drafting customer or vendor emails                       | An AI draft; a person sends it                        |

## 2. Stakeholders

OrderPilot's users are Spectra's staff only. Customers, vendors and forwarders never log in. Until the briefing call, everything in this table is our reading of the brief.

| Group                                      | OrderPilot role   | Their stake                                                    | What they would need from OrderPilot                                                       |
| ------------------------------------------ | ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Support                                    | `SUPPORT`         | Handles most documents and keeps every order current           | Fields read for them, only the doubtful ones to confirm, and PIs and updates drafted       |
| Product Managers                           | `PRODUCT_MANAGER` | Own brands, stock levels and SPRs                              | An SPR pre-filled from a shortfall, and its approval visible without chasing               |
| The approver (Janet)                       | `APPROVER`        | Approves SPRs and requests within a limit                      | Each request with its checks already done, and reminders that do not flood                 |
| Warehouse                                  | `WAREHOUSE`       | Packs only paid orders, and checks incoming goods              | A packing task that appears only after payment, and documents side by side with mismatches |
| Finance                                    | `FINANCE`         | Confirms customer payments and pays vendors                    | Payment status per order, and a hold whenever a vendor's bank details change               |
| Logistics                                  | `LOGISTICS`       | Forwarders, shipment dates, AWB/BL and import permits          | Overdue paperwork flagged, and shipping details sent without re-typing                     |
| Management                                 | `MANAGEMENT`      | Throughput, delays and errors                                  | One tracker, and the five measures actually measured                                       |
| Auditors                                   | `AUDITOR`         | Proof that approvals and payments followed the controls        | A tamper-evident trail, read-only                                                          |
| IT and whoever supports Navision           | `SYSTEM_ADMIN`    | Keep Navision stable and the system of record                  | Supported interfaces only, least privilege, health and logs                                |
| Customers (South Asia and the Middle East) | None              | Pay first, then wait for goods and papers                      | Correct PIs and invoices, and timely shipping updates                                      |
| Vendors and brands                         | None              | Send PIs, invoices and packing lists, and expect payment       | POs that match, and payment on time to the right account                                   |
| Forwarders                                 | None              | Collect goods and issue the AWB/BL                             | Complete papers and a clear release                                                        |
| The module team and lecturers              | None              | Assess design thinking, GRS, AI use, practice, Git and running | Evidence for M1 to M6, traced in [the matrix](requirements-traceability.md)                |

The approver, Finance and Management hold the most influence over whether OrderPilot is trusted, so their reviews come first. Support and the Product Managers feel the pain most, so they are the first people we would ask to try the prototype.

## 3. Pain points

Each pain point is from the brief. What it costs is our hypothesis until Spectra confirms it.

| #   | Pain point                                                     | What it probably costs                                                                      | Felt by                     | Capability |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------- | ---------- |
| 1   | The same data is typed again for each step                     | Hours of keying, and every copy is a chance to mistype a part number, quantity or price     | Support, Warehouse, Finance | A, B       |
| 2   | Documents are compared by eye                                  | A short shipment or a wrong price is found late, sometimes only when the customer complains | Support, Warehouse, Finance | D          |
| 3   | Approvals are chased                                           | An SPR sits unanswered while the sales order waits for its stock                            | Product Managers, approver  | C          |
| 4   | Payments are chased                                            | Packing waits for news of the payment, and a vendor's due date can slip                     | Finance, Support, Warehouse | C          |
| 5   | Shipping papers are chased                                     | A missing AWB/BL or import permit holds goods at the border after the customer has paid     | Logistics                   | C, D       |
| 6   | Six hand-offs and no shared view                               | Nobody can say where an order is or who holds it without asking around                      | Everyone, Management        | D          |
| 7   | A vendor's bank details arrive on each PI                      | A changed account, by mistake or by fraud, is easy to miss by eye. Our inference            | Finance                     | F          |
| 8   | Who approves what, and up to which limit, is in people's heads | The rules are applied unevenly and are hard to show an auditor                              | Approver, auditors          | C, F       |

Because customers pay in advance, every delay between payment and shipment lands on someone who has already paid.

## 4. Root cause

Asking why, five times:

1. **Why is data typed more than once?** It arrives as PDFs, scans and spreadsheets that no system reads, so a person keys it in.
2. **Why are mismatches found late?** Each group checks only the documents in front of it, by eye.
3. **Why does everyone chase?** The order of the steps and who owns each one is known by people, not held by a system that could route work and remind.
4. **Why is there no shared status?** Every group sees only its own step, and no system ties the steps together into one order.
5. **Why has Navision not fixed it?** Our hypothesis, to test at the briefing call: Navision records orders well, but it was not built to read incoming documents, to cross-check one party's papers against another's, or to hand work from one group to the next.

**The root cause.** An order's facts arrive in documents that nothing reads, and the rules that connect them are known by people and kept in inboxes, not in a system. Each hand-off therefore means re-typing, re-checking and chasing. The missing piece is a layer that reads each document once with a person confirming the doubtful parts, cross-checks the documents with one another and with Navision, routes the work under explicit rules, and shows each order's full trail. Navision stays the system of record: OrderPilot prepares and checks, and staff post.

## 5. Constraints

### Regulatory

Not legal advice: Spectra and its advisers decide what applies. The prototype runs on synthetic data and builds the controls in. **We do not claim that the prototype is PDPA compliant.**

| Area                                      | What it means for the design                                                                                                                                                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Singapore's PDPA                          | Customer and vendor contacts are mostly business contact information, but staff accounts, the audit trail and analytics are personal data. Collect only what a step needs, protect it, keep it no longer than needed, and take care when data leaves Singapore |
| Record keeping                            | Transaction records are kept for years (five is the usual Singapore rule). Navision stays the book of record; OrderPilot keeps its own trail and sets retention per record type                                                                                |
| Export and import rules                   | Shipments need permits, and some IT goods may be controlled. OrderPilot tracks permits as Spectra defines them, and Spectra decides what is controlled                                                                                                         |
| Financial controls                        | Segregation of duties, approval limits and checked changes to bank details. Good practice to confirm with Spectra's auditors                                                                                                                                   |
| Singapore's Model AI Governance Framework | Human oversight in proportion to impact. The AI reads and drafts; people decide                                                                                                                                                                                |

### Technical

- **Navision is unknown.** Its version, hosting, customisation and interfaces are all open. OrderPilot reaches it only through a connector (planned: P-20), against an OData-style mock until we know more (planned: P-19). [The domain notes](research/domain-notes.md) list what standard Navision keeps.
- **Every customer and vendor has its own layout.** Mappings are proposed by AI and approved by a person, so a new layout needs no code.
- **Extraction is never certain.** Each field gets a confidence score and points back to where it was read, and doubtful fields wait for a person.
- **Documents must agree.** Customers, vendors and items are identified by their Navision numbers, not their names, and each check states its tolerance.
- **Money.** Prices are in USD. Totals, freight and rounding differ between documents, so checks state their tolerance.
- **Email is messy.** The same PO can arrive twice or forwarded, so duplicates are found by content hash.
- **The books must stay clean.** A write to Navision would need a preview and an approval, and stays against the mock until Spectra agrees.
- **Rules not yet confirmed** (the SPR trigger, the PI sequence, approvers and limits, delegation) are configuration, never code.
- **Volumes are unknown,** so work runs on queues, and every list is paged and indexed.

### Organisational

- Six groups own one order, so gains are measured across the hand-offs.
- Staff keep posting in Navision, and money stays under their control.
- Approvals and payments may be audited long afterwards, so every action keeps its evidence.

### Project

- Four Year-2 students, one semester: proposal in Week 5, mock interview in Week 7, technical review in Week 13, final in Week 18.
- Most of the marks (85%) are individual, so the work is split into four areas with clear owners ([module ownership](team/module-ownership.md)).
- Synthetic data only, labelled "Synthetic demo data". Every external system is a mock, labelled "Mock", until Spectra's samples arrive. Client samples never enter Git.
- No access to Spectra's systems is assumed. No client branding without permission.
- The mock AI provider is the default, so a demo needs no paid key, and we measure what the AI costs for each document.

## 6. Scope

**Must, for the Week 4 prototype and Week 5 proposal: the sales pilot.**

| Must                                                            | Capability | Area                                           |
| --------------------------------------------------------------- | ---------- | ---------------------------------------------- |
| PO upload, with AI classification and extraction                | A, E       | 1                                              |
| A person confirms the uncertain fields                          | A, E       | 1                                              |
| A stock lookup in mock Navision                                 | B          | 1                                              |
| An SPR raised by a button and approved                          | C          | 2                                              |
| The tracker                                                     | D          | 3                                              |
| One mismatch: a packing list whose quantity differs from the PO | D          | 3                                              |
| The permission check, enforced on the server                    | F          | 4 (the policy) and 1 (the guard that calls it) |

**Should, by Week 13, in this order:**

1. The payment gate: no packing until Finance confirms the payment (areas 2 and 4).
2. A PI draft that Support reviews (area 2, on area 1's template engine).
3. Full matching of invoices and packing lists (area 3).
4. Follow-ups for the AWB/BL and import permits, with reminders and escalation (area 2).
5. Email intake, with updates that AI drafts and a person sends (areas 1 and 2).
6. More check rules (area 3).

**Phase 2, built in Weeks 8 to 12, shown at the Week 18 final:** the purchase flow. An SPR becomes a vendor PO draft, the vendor's PI is checked against the vendor's bank details on record, a changed account holds the payment, the received goods are compared with their documents, and a reminder fires when payment falls due.

**Throughout:** layout mappings, master data from mock Navision, the template engine, governance (roles, segregation of duties, limits, masking, audit, retention and the rules for data sent to AI), monitoring (logs, traces, metrics, clickstream and AI cost), and an English UI in light and dark themes that meets WCAG 2.2 AA.

**Later, only if Spectra asks:** a real Navision link, write-back with controls, and forwarder tracking.

**Out of scope:**

| Out of scope                                    | Why                                                        |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Replacing Navision                              | It is the system of record                                 |
| Posting transactions automatically              | People post, and keep control of the books                 |
| Real payments                                   | Finance pays through its own bank                          |
| Real emails to customers or vendors             | Drafts only; a person sends them                           |
| Booking forwarders or filing permits            | Forwarders and every country run their own systems         |
| Accounting, stocktakes and financial statements | Navision does these                                        |
| Real customer, vendor, price or bank data       | Only synthetic data, in Spectra's formats                  |
| Customer or vendor log-ins                      | OrderPilot is for Spectra's staff                          |
| Single sign-on                                  | Demo accounts for now; the auth module can take it later   |
| Legal, tax and export-control decisions         | OrderPilot provides controls and evidence; Spectra decides |

## 7. Success metrics

Spectra's five measures come first. There are no baselines yet, so each is a lab estimate on synthetic data until Spectra gives real numbers. [The measurement protocol](design-thinking/success-metrics.md) says how each is measured, manual against OrderPilot.

| Spectra's measure        | How OrderPilot measures it                                                         | Baseline |
| ------------------------ | ---------------------------------------------------------------------------------- | -------- |
| Order-processing time    | Elapsed time per step, PO received to goods released, read from the order's events | To ask   |
| Manual touches per order | Hand-typed or hand-corrected fields, plus hand-offs between groups                 | To ask   |
| Data-entry errors        | Confirmed values later found wrong, per 100 fields                                 | To ask   |
| Approval turnaround      | Hours between an SPR being raised and decided                                      | To ask   |
| Overdue orders           | Orders late on any step, counted by step and owner                                 | To ask   |

Our own targets, each with a test:

| Target                                         | Test                                                                         | Area |
| ---------------------------------------------- | ---------------------------------------------------------------------------- | ---- |
| Extraction accuracy of 95% or more             | Correct fields on the synthetic test set (planned: P-21's ground truth)      | 1    |
| Every seeded mismatch flagged                  | The planted mistakes in the synthetic documents                              | 3    |
| No duplicate orders                            | The same PO submitted twice                                                  | 1    |
| 100% of workflow tests passing                 | The workflow test cases                                                      | 2    |
| Time and touches per order measured            | The measurement protocol, manual against OrderPilot                          | 1, 2 |
| Every overdue follow-up visible                | Overdue payments, AWB/BL and permits on the tracker                          | 2, 3 |
| Every unauthorised call refused and audited    | Direct API calls by the wrong role (E2E #3)                                  | 4    |
| A changed bank detail always holds the payment | A vendor PI with a different account (E2E #4)                                | 4    |
| No AI output acts without a person             | Each AI suggestion or draft traced to a person's decision in the audit trail | 1, 4 |
| AI cost per document known                     | Token usage and cost per document and feature                                | 4    |

## 8. Open questions

These change the design most. They are written out in full, in priority order, in [the questions for the client](client/questions-for-client.md).

- Navision: version, cloud or on-premise, interfaces, customisation, and a test company.
- How documents reach Spectra, their formats, and the monthly volume.
- Which flow is the pilot, and which step wastes the most time.
- The PI sequence: does the customer or the warehouse get the PI first?
- When an SPR is raised in a sale.
- Approvers, limits and delegation.
- What counts as a mismatch, and what happens next.
- How payments are confirmed, and how vendor bank details are checked.
- Forwarders, AWB/BL formats and each country's import permits.
- Baselines for the five measures, and the costliest errors.
- Which channels staff use, and whether OrderPilot may send or only draft.
- Whether an AI service may be used, in which region, and what it must never see.
- Who signs off the results.

Until Spectra answers, four rules stay as configuration: when an SPR is raised, the PI sequence, who approves up to what limit, and delegation.
