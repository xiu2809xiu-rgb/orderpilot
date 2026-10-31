# GRS by design

How governance, risk and sustainability are built into OrderPilot from the start. This is M2, GRS by design. T-7 (Sprints 3 and 4) takes it further for the proposal, and each area owner keeps their own rows current.

> **Not legal advice, and no compliance claim.** The prototype runs on synthetic data and builds controls in. **We do not claim that the prototype is PDPA compliant.** Whether OrderPilot meets the PDPA, or any other law, in Spectra's hands is for Spectra and its advisers to decide.

## Governance

Who decides what, and how the decisions stay visible.

### Decision rights

| Decision                                          | Who makes it                                                      | Where it is recorded                                |
| ------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| Approving an SPR, a request or a vendor PO draft  | A person with the right and within the limit, never the requester | The audit trail                                     |
| Confirming an extracted field                     | Support, or whoever the field's rule names                        | The field's provenance and the audit trail          |
| Confirming a payment and opening the payment gate | Finance                                                           | The audit trail                                     |
| Clearing a bank-detail hold                       | Finance plus a second approver, neither of them the requester     | The audit trail                                     |
| Approving a layout mapping                        | A person, after the AI proposes it                                | The mapping's version and the audit trail           |
| Sending a customer or vendor message              | A person, after the AI drafts it                                  | The audit trail                                     |
| Posting to Navision                               | Staff, in Navision. OrderPilot never posts                        | Navision                                            |
| What data may go to which AI provider             | Area 4's policy; the default is synthetic data only               | The policy's configuration and the AI usage records |
| The open business rules                           | Spectra; until then configuration, never code                     | [The assumptions](../assumptions.md) A-21 to A-24   |
| Architecture and process decisions                | The team, and Richie for changes to the plan                      | ADRs in `docs/adr/`                                 |

### The AI rules

- The AI reads, classifies, extracts, explains and drafts. It never approves, buys, posts, releases goods or pays.
- AI output is a draft until a person confirms it, and each extracted field keeps its confidence and its source.
- No model output triggers an action (planned: P-17).
- Every AI call is recorded: the model, tokens, estimated cost, feature, user, document and outcome (planned: P-17, shown by G-1).

### Controls in the product

| Control                                                         | What it stops                            | Planned in     |
| --------------------------------------------------------------- | ---------------------------------------- | -------------- |
| Authorisation enforced on the server                            | A hidden button being the only barrier   | P-10, F-1, F-3 |
| No self-approval and segregation of duties                      | One person requesting and approving      | F-4            |
| Approval limits, in the shape of Navision's Approval User Setup | Approvals above a person's authority     | F-3, C-3       |
| The bank-detail hold                                            | Payment to a changed account             | F-5            |
| Masking of bank details and prices by role, with a reason       | Over-exposure of sensitive data          | F-1            |
| A tamper-evident audit trail, append-only and hash-chained      | Silent changes to the record             | P-9, F-2       |
| Every refusal audited                                           | Probing that nobody sees                 | P-10, F-1      |
| Synthetic data only, labelled                                   | Real data leaking through demos or tests | Every story    |

### GRS in the UI

Classification badges, masked fields with a reason, audit links, approval steps, and AI confidence with "Requires approval" (planned: P-12, then each area's screens).

## Risk register

Likelihood and impact are rated low, medium or high for Spectra if OrderPilot were in use. Each risk has an owner area, and its controls name the story that brings them. Every control below is planned.

| #    | Risk                                                                                                                                   | Likelihood | Impact | Controls                                                                                                                                                                                                            | Owner | Residual |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------- |
| R-01 | **AI errors:** a misread part number, quantity or price flows into the order                                                           | High       | High   | Confidence per field and a link to its source; a person confirms doubtful fields; fixed rules check the documents against each other; accuracy measured against 95% (P-17, P-18, P-21, D-2)                         | 1, 3  | Medium   |
| R-02 | **Bank-detail fraud:** a vendor PI with changed bank details sends a payment to the wrong account                                      | Medium     | High   | Compare with the Vendor Bank Account on record; any difference holds the payment until Finance and a second approver both release it; bank details masked by role; every clearing audited (F-1, F-5, E2E #4)        | 4     | Low      |
| R-03 | **Data leaking to AI providers:** a client document, price or contact reaches a third-party AI service                                 | Medium     | High   | The mock provider is the default; area 4's policy decides what may go to which provider, synthetic data only by default; no Spectra document without written OK, in an approved region; usage recorded (P-17, F-1)  | 4, 1  | Low      |
| R-04 | **PDPA:** personal data (contacts on documents, staff accounts, the audit trail, analytics) collected, kept or sent abroad beyond need | Medium     | Medium | Collect only what each step needs; mask by role; retention per record type; analytics with consent and no PII (G-1); hosting in Singapore (P-24); synthetic data in development                                     | 4     | Medium   |
| R-05 | **Prompt injection:** text inside a document tries to steer the model                                                                  | Medium     | Medium | Documents treated as data; the model only returns fields, validated by a schema; no model output triggers an action; injection tests (P-17, area 1's stories)                                                       | 1     | Low      |
| R-06 | **ERP changes:** Spectra's Navision is older, customised or upgraded, so fields or interfaces differ                                   | High       | Medium | One connector behind an interface, with contract tests against the mock; Navision's names in [the data formats](../data-formats.md); a health probe and retries; any write-back previewed and approved (P-19, P-20) | 1     | Medium   |
| R-07 | **Duplicate orders:** the same PO arrives twice and is processed twice                                                                 | Medium     | Medium | Duplicate detection by content hash and by customer plus PO number (P-18, area 1's duplicate-PO story)                                                                                                              | 1     | Low      |
| R-08 | **Self-approval or collusion:** one person requests and approves, or approves above their limit                                        | Low        | High   | No self-approval, segregation of duties and approval limits, enforced on the server and tested with direct calls (F-3, F-4, E2E #3)                                                                                 | 4     | Low      |
| R-09 | **Keys or client samples in Git:** the repository is public                                                                            | Medium     | High   | Ignore rules (today); licence-key, samples and secret guards in the hooks (P-5); gitleaks in CI (P-6); push protection (today)                                                                                      | 1     | Low      |
| R-10 | **Over-trust in AI:** staff confirm everything without reading                                                                         | Medium     | Medium | Low-confidence fields marked "Requires approval"; some fields always need a person; the error rate measured after confirmation ([success metrics](../design-thinking/success-metrics.md))                           | 1     | Medium   |
| R-11 | **AI cost overrun:** model calls cost more than the time they save                                                                     | Low        | Low    | AI only where it helps; the cost per document tracked and shown, with budgets and alerts (P-17, G-1)                                                                                                                | 4     | Low      |

The owners review their rows at each sprint review, and add a row when a story brings a new risk.

## Sustainability

- **Less re-typing.** A document is read once and confirmed once, so staff time goes to checking and deciding, not keying.
- **Fewer reshipments.** Mismatches caught before goods ship mean fewer wrong shipments, returns and second freight legs, which saves money and the emissions of moving goods twice.
- **AI only where it helps.** Classification, extraction, explanations and drafts use AI; comparisons, routing and limits are fixed rules, which cost nothing to run. The AI's usage and cost are tracked per document (planned: P-17, G-1), so a feature whose cost outweighs its use can be switched off.
- **Small by default.** The mock provider is the default in development and demos, and the demo runs on one small server (planned: P-24).
- **Less paper.** Documents stay digital, from the PO to the AWB/BL.
- **Social.** The UI meets WCAG 2.2 AA, the warehouse screens work on a tablet, and people keep every decision.

## Where this goes next

- **T-7** turns this into the proposal's GRS section and checks every control against the prototype.
- **Area 4** owns the policy, masking, audit and the rules for data sent to AI, and keeps R-02 to R-04, R-08 and R-11 current.
- **Each story** that adds a control updates its row here and in [the traceability matrix](../requirements-traceability.md).
