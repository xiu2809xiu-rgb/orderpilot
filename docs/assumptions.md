# Assumptions

What we assume until Spectra tells us otherwise. Each one is checked at the briefing call (T-2, Sprint 2) through [the questions for the client](client/questions-for-client.md), then marked confirmed, changed or dropped here, in the same pull request as any work it changes.

- **Status:** Open (not yet asked), Confirmed, Changed (with what changed) or Dropped.
- **If wrong:** what we would have to change.
- **Q:** the question that settles it.

## The client and its data

| #    | Assumption                                                                                                    | If wrong                                                     | Q   | Status |
| ---- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | --- | ------ |
| A-01 | Prices are quoted in USD, and most customers pay before shipment                                              | The payment gate and the price checks need other currencies  | Q-9 | Open   |
| A-02 | Navision's numbers (customer, vendor and item No.) are stable and unique, so we match on them, never on names | Matching needs another key, and look-alike names get riskier | Q-1 | Open   |
| A-03 | Documents arrive mostly by email, as PDF, scans or Excel, and staff can also upload them                      | Intake needs another channel (portal, EDI or paper)          | Q-2 | Open   |
| A-04 | Each customer and vendor keeps one layout for each document type, which changes rarely                        | Layout mapping needs more versions, or per-document review   | Q-2 | Open   |
| A-05 | Documents are in English                                                                                      | Extraction and the UI need more languages                    | Q-2 | Open   |
| A-06 | Spectra's local currency in Navision is SGD, so amounts marked (LCY) are in SGD                               | The credit and balance checks read the wrong currency        | Q-1 | Open   |

## Navision

Every Navision detail below comes from standard Microsoft Dynamics NAV, as written up in [the domain notes](research/domain-notes.md). Spectra's copy may be older or customised.

| #    | Assumption                                                                                                               | If wrong                                                     | Q    | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ---- | ------ |
| A-10 | Spectra runs a standard Navision version that publishes pages as web services (SOAP, and OData from NAV 2013)            | The connector reads exports instead, on a schedule           | Q-1  | Open   |
| A-11 | Its records carry the standard fields: Customer, Vendor, Vendor Bank Account, Item, Sales and Purchase Headers and Lines | [The data formats](data-formats.md) and the mock change      | Q-1  | Open   |
| A-12 | Staff keep posting in Navision, and OrderPilot reads posted documents but never posts                                    | None for the pilot. A write-back would need its own controls | Q-1  | Open   |
| A-13 | The PI is a pro forma printed from the Navision sales order, and the customer's payment is recorded in Navision          | The PI draft and the payment gate change their source        | Q-13 | Open   |
| A-14 | Approval limits and approvers are set up in Navision's Approval User Setup, or could be                                  | OrderPilot keeps its own limits, as configuration            | Q-14 | Open   |
| A-15 | Vendors' bank details live in Navision's Vendor Bank Account, and only Finance may change them                           | The bank-detail check compares against another source        | Q-15 | Open   |
| A-16 | Forwarders and AWB/BL numbers are recorded in Navision as the Shipping Agent Code and the Package Tracking No.           | The follow-ups keep their own record of them                 | Q-16 | Open   |
| A-17 | Available stock is Inventory minus Qty. on Sales Order plus Qty. on Purch. Order                                         | The stock check and the SPR suggestion use another formula   | Q-1  | Open   |
| A-18 | The duplicate-PO check can use Sell-to Customer No. plus External Document No. (the customer's PO number)                | Duplicates need another key, such as the content hash alone  | Q-1  | Open   |

## The process

| #    | Assumption                                                                                                     | If wrong                                                    | Q    | Status |
| ---- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---- | ------ |
| A-20 | The pilot is the sales flow, from the customer's PO to the tracker                                             | The Must list moves to the purchase flow                    | Q-3  | Open   |
| A-21 | **Open rule, configurable:** an SPR is raised when stock is short. In the MVP a person raises it with a button | Only the configuration changes                              | Q-5  | Open   |
| A-22 | **Open rule, configurable:** the PI goes to the customer first, and to the warehouse after payment             | Only the configuration changes                              | Q-4  | Open   |
| A-23 | **Open rule, configurable:** one approver (Janet) approves SPRs up to a limit, and amounts above it escalate   | Only the configuration changes                              | Q-6  | Open   |
| A-24 | **Open rule, configurable:** while the approver is away, a named substitute approves                           | Only the configuration changes                              | Q-6  | Open   |
| A-25 | Packing starts only after Finance confirms the payment                                                         | The payment gate becomes a warning, not a block             | Q-9  | Open   |
| A-26 | A quantity difference between the packing list and the PO is a mismatch, with no tolerance                     | The rule gets a tolerance, or partial shipments are allowed | Q-8  | Open   |
| A-27 | Customers send import permits or ask for them, and Logistics follows them up                                   | The permit follow-up changes owner or disappears            | Q-10 | Open   |
| A-28 | Each Product Manager owns certain brands, and sees only those orders                                           | The data scope in area 4's policy changes                   | Q-17 | Open   |
| A-29 | Returns and credit notes are rare, and stay in Navision                                                        | They become their own documents in OrderPilot               | Q-18 | Open   |

## Technology and data

| #    | Assumption                                                                                                                   | If wrong                                                            | Q    | Status |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---- | ------ |
| A-30 | No access to Spectra's systems during the semester, so Navision and the mailbox are mocks                                    | None: the connector is built to swap the mock for the real thing    | Q-1  | Open   |
| A-31 | No Spectra document goes to a third-party AI service. If Spectra allows it later, it is in writing and in an approved region | Until then, client samples are tried only with the mock AI provider | Q-12 | Open   |
| A-32 | Customer contacts on documents are business contact information, but we still treat them as personal data                    | None: the stricter treatment holds either way                       | Q-12 | Open   |
| A-33 | Staff use email and Excel, and may only receive drafts, never messages sent for them                                         | Notifications could also go to another channel                      | Q-11 | Open   |
| A-34 | Volumes are small: hundreds of orders a month, not thousands                                                                 | Queues and paging already cope; the load test (k6) checks it        | Q-2  | Open   |
| A-35 | A demo hosted in Singapore is acceptable                                                                                     | Deployment moves region                                             | Q-12 | Open   |
