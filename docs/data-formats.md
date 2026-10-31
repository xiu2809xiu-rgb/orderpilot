# Data formats

The formats we assume for every document OrderPilot reads or drafts, and for every Navision record it reads. **All of them are assumptions to confirm** at the briefing call (T-2), with Spectra's samples ([what we ask for first](client/questions-for-client.md#ask-for-these-first)).

- **Navision's names.** Fields are named as standard Navision names them, so that Spectra's staff recognise them. They come from [the domain notes](research/domain-notes.md), and Spectra's Navision may be older or customised (A-10, A-11 in [the assumptions](assumptions.md)).
- **The mock speaks camelCase.** The mock Navision (planned: P-19) answers in OData-style JSON with the same names in camelCase. The connector (planned: P-20) maps the real names to these.
- **Synthetic data only.** Every example here is invented. Bank details are obviously fake, and prices are in USD.

## Status of each format

| Format                      | Source of our assumption               | Confirmed |
| --------------------------- | -------------------------------------- | --------- |
| Every document in this file | The brief and the domain notes         | Not yet   |
| Every Navision record       | Standard Navision, in the domain notes | Not yet   |

When a sample confirms or changes a format, update its section, mark it here with the date, and update the matching assumption.

## Documents

Each document lists the fields OrderPilot reads, and the Navision field each one maps to. Every field extracted by AI keeps a confidence score and a link to where it was found in the document (planned: P-18 and area 1's extraction stories).

### Customer PO

- **From:** the customer, by email. **Format:** PDF, a scan of one, or Excel. One layout per customer (A-04).
- **Becomes:** a sales order. Navision stays the place where it is posted.

| Field on the PO         | Navision field                 | Notes                                                                                      |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ |
| Customer name, address  | Sell-to Customer No. (matched) | Matched on the customer No., never on the name. A look-alike name is a possible match only |
| PO number               | External Document No.          | With Sell-to Customer No., the key of the duplicate-PO check                               |
| PO date                 | Order Date                     |                                                                                            |
| Requested shipment date | Shipment Date                  | Often missing                                                                              |
| Currency                | Currency Code                  | Assumed USD                                                                                |
| Shipping terms          | Shipment Method Code           | For example FOB or CIF                                                                     |
| Line: part number       | Sales Line No. (the Item No.)  | Matched on the item No.; the customer's own code may differ                                |
| Line: description       | Sales Line Description         | For review only, never for matching                                                        |
| Line: quantity          | Sales Line Quantity            |                                                                                            |
| Line: unit price        | Sales Line Unit Price          | Checked against the customer's price group                                                 |
| Line: amount            | Sales Line Line Amount         | Checked as quantity times unit price, within a tolerance                                   |
| Total                   | None (derived)                 | Checked against the sum of the lines                                                       |

### SPR (Sales Purchase Requisition)

- **From:** a Product Manager. **Format today:** unknown; we have asked for the form (request 1). In OrderPilot it is a record of its own, numbered like `SPR-20261102-0001`.
- **Becomes:** an approval task, then a vendor PO draft (planned: phase 2).

| Field                             | Navision field it relates to              |
| --------------------------------- | ----------------------------------------- |
| SPR number                        | None: OrderPilot's own number             |
| Raised by, date                   | None: OrderPilot's own record             |
| The sales order it serves, if any | Sales Header No.                          |
| Item, quantity, unit cost (USD)   | Item No., Unit Cost                       |
| Suggested vendor                  | Item: Vendor No., Vendor Item No.         |
| Reason                            | None                                      |
| Approver and decision             | Approval User Setup (Approver ID, limits) |

### Proforma invoice (PI) to the customer

- **From:** Support, assumed to be printed from the Navision sales order (Q-13). **Format:** PDF.
- **OrderPilot's part:** a PI draft for Support to review (planned: Should 2), carrying Spectra's bank details, masked by role.

Fields: the sales order's header and lines, Prepayment %, Payment Terms Code, the amount due, and Spectra's bank details (bank name, account number, SWIFT code).

### Payment confirmation

- **From:** the customer's bank advice or remittance, seen by Finance. **Format:** PDF or email text (Q-9, Q-13).
- **OrderPilot's part:** Finance confirms the payment, and the payment gate opens (planned: C-1, then area 2). The record carries a payment type, prepayment among them.

Fields: the payer, the amount and currency, the value date, the bank reference, and the PI or sales order it pays.

### Commercial invoice

- **From:** Support, assumed to be a Posted Sales Invoice in Navision. **Format:** PDF.
- **OrderPilot's part:** reads it and checks it against the PO and the packing list. It never posts one.

Fields: the invoice No., the sales order No., External Document No., the lines (No., Description, Quantity, Unit Price, Line Amount) and the totals.

### Packing list

- **From:** the warehouse for sales, or the vendor for purchases. **Format:** PDF or Excel.
- **OrderPilot's part:** the Must mismatch: a packing list whose quantity differs from the PO (planned: D-1, then area 3).

| Field                        | Navision field it relates to            |
| ---------------------------- | --------------------------------------- |
| Packing list number, date    | Posted Sales Shipment No.               |
| The order it belongs to      | Sales Header No., External Document No. |
| Line: part number, quantity  | Sales Line No., Qty. to Ship            |
| Cartons, weights, dimensions | None: carried for the forwarder         |

### AWB/BL

- **From:** the forwarder (an air waybill or a bill of lading). **Format:** PDF.
- **OrderPilot's part:** the follow-up after shipment (planned: Should 4). The number fills the sales order's Package Tracking No. after a person approves it (A-16).

Fields: the AWB or BL number (Package Tracking No.), the carrier or forwarder (Shipping Agent Code), the ports or airports, the dates, the shipper and consignee, the cartons and weights, and the order or invoice it covers.

### Import permit

- **From:** the destination country's authority, through the customer or Logistics (Q-10). **Format:** PDF.
- **OrderPilot's part:** a follow-up with a status and a due date. Spectra decides which goods need one.

Fields: the permit number, the country, the issue and expiry dates, the importer, and the goods or invoice it covers.

### Vendor PI

- **From:** the vendor, by email, quoting our PO number. **Format:** PDF.
- **OrderPilot's part:** checked against the vendor PO, and its bank details against the Vendor Bank Account on record. Any difference holds the payment until Finance and a second approver release it (planned: phase 2, area 4, E2E #4).

| Field on the vendor PI   | Navision field                                          |
| ------------------------ | ------------------------------------------------------- |
| Vendor                   | Buy-from Vendor No. (matched on the No.)                |
| Our PO number            | Purchase Header No.                                     |
| Their PI or order number | Vendor Order No.                                        |
| Lines                    | Purchase Line No., Quantity, Direct Unit Cost           |
| Prepayment, if any       | Prepayment %                                            |
| Bank details             | Vendor Bank Account: Bank Account No., SWIFT Code, IBAN |

### Vendor invoice

- **From:** the vendor. **Format:** PDF.
- **OrderPilot's part:** checked with the packing list and the AWB/BL when goods arrive. Finance pays it on the due date.

Fields: Vendor Invoice No., the Purchase Header No., the lines, the totals, the due date, and the bank details (checked as on the vendor PI).

## Navision records

What OrderPilot reads from Navision. The mock (planned: P-19) serves the same records, behind an API key, with paging and `$filter`. The camelCase name drops dots, brackets and slashes, joins the words, writes `%` as `Percent` and `(LCY)` as `Lcy`.

| Record              | Navision fields                                                                                                                                                                   | In the mock, camelCase                                                                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Customer            | No., Name, Country/Region Code, Currency Code, Payment Terms Code, Customer Price Group, Credit Limit (LCY), Balance (LCY)                                                        | `no`, `name`, `countryRegionCode`, `currencyCode`, `paymentTermsCode`, `customerPriceGroup`, `creditLimitLcy`, `balanceLcy`                                                                |
| Vendor              | No., Name, Currency Code, Payment Terms Code                                                                                                                                      | `no`, `name`, `currencyCode`, `paymentTermsCode`                                                                                                                                           |
| Vendor Bank Account | Vendor No., Code, Name, Bank Account No., SWIFT Code, IBAN                                                                                                                        | `vendorNo`, `code`, `name`, `bankAccountNo`, `swiftCode`, `iban`                                                                                                                           |
| Item                | No., Description, Base Unit of Measure, Unit Price, Unit Cost, Inventory, Qty. on Sales Order, Qty. on Purch. Order, Vendor No., Vendor Item No.                                  | `no`, `description`, `baseUnitOfMeasure`, `unitPrice`, `unitCost`, `inventory`, `qtyOnSalesOrder`, `qtyOnPurchOrder`, `vendorNo`, `vendorItemNo`                                           |
| Sales Header        | No., Sell-to Customer No., External Document No., Order Date, Shipment Date, Currency Code, Prepayment %, Shipment Method Code, Shipping Agent Code, Package Tracking No., Status | `no`, `sellToCustomerNo`, `externalDocumentNo`, `orderDate`, `shipmentDate`, `currencyCode`, `prepaymentPercent`, `shipmentMethodCode`, `shippingAgentCode`, `packageTrackingNo`, `status` |
| Sales Line          | Document No., Line No., Type, No., Description, Quantity, Unit Price, Line Amount, Qty. to Ship, Quantity Shipped                                                                 | `documentNo`, `lineNo`, `type`, `no`, `description`, `quantity`, `unitPrice`, `lineAmount`, `qtyToShip`, `quantityShipped`                                                                 |
| Purchase Header     | No., Buy-from Vendor No., Vendor Order No., Vendor Invoice No., Expected Receipt Date, Prepayment %, Status                                                                       | `no`, `buyFromVendorNo`, `vendorOrderNo`, `vendorInvoiceNo`, `expectedReceiptDate`, `prepaymentPercent`, `status`                                                                          |
| Purchase Line       | Document No., Line No., Type, No., Description, Quantity, Direct Unit Cost, Line Amount                                                                                           | `documentNo`, `lineNo`, `type`, `no`, `description`, `quantity`, `directUnitCost`, `lineAmount`                                                                                            |
| Posted documents    | Posted Sales Shipment, Posted Sales Invoice, Posted Purchase Receipt: their headers and lines                                                                                     | Read only. OrderPilot never posts                                                                                                                                                          |
| Approval User Setup | User ID, Approver ID, Sales Amount Approval Limit, Purchase Amount Approval Limit, Unlimited Sales Approval, Unlimited Purchase Approval, Substitute                              | `userId`, `approverId`, `salesAmountApprovalLimit`, `purchaseAmountApprovalLimit`, `unlimitedSalesApproval`, `unlimitedPurchaseApproval`, `substitute`                                     |
| No. Series          | Code, Description, the last number used                                                                                                                                           | `code`, `description`, `lastNoUsed`                                                                                                                                                        |

**Status values.** Sales Header Status is Open, Released, Pending Approval or Pending Prepayment in standard Navision. This is Navision's document status, not the order's status in OrderPilot, which lives only in area 2's state machine.

**Numbers.** Navision's numbers are the official ones. OrderPilot shows them beside its own numbers, which take a type prefix, the date and a running number, such as `SPR-20261102-0001` (planned: P-7 and C-1).

**Stock.** Available stock is Inventory minus Qty. on Sales Order plus Qty. on Purch. Order (A-17). A shortfall suggests an SPR, which a person raises.

**Example.** One synthetic customer, as the mock is planned to return it:

```json
{
  "value": [
    {
      "no": "C00010",
      "name": "Synthetic Demo Traders Colombo",
      "countryRegionCode": "LK",
      "currencyCode": "USD",
      "paymentTermsCode": "PREPAY",
      "customerPriceGroup": "DIST-B",
      "creditLimitLcy": 0,
      "balanceLcy": 0
    }
  ]
}
```

The exact envelope, paging and filters are P-19's to fix, and it updates this section when it does.

## Trying a client sample safely

When Spectra sends samples, they are used to confirm the formats above and nothing else.

1. **Only with Spectra's OK,** and only on one machine. The person who receives them saves them in `samples/` at the repository root, which Git ignores (today). The samples guards in the Git hooks (planned: P-5) refuse any sample file in a commit or a push.
2. **Never to an AI.** Don't open a sample in an AI tool, paste it into a chat or send it to a third-party AI service. No Spectra document goes to one without Spectra's written OK, in an approved region (A-31). OrderPilot's AI provider stays on `mock` (planned: P-17).
3. **On the throwaway stack only.** Run OrderPilot against a sample only on the samples stack, which only that machine can reach and which is deleted afterwards (planned: P-13). Until P-13 exists, read the samples by eye and run no code on them.
4. **Write down shapes, not values.** Record what you learn in this file, in our own words: the fields, their order, the layout, the number formats. Never a name, a price, an account number or a screenshot.
5. **Delete when done.** Delete the samples from `samples/` once the formats are recorded, or sooner if Spectra asks, and add a line to the log below.

### Sample log

| Date | Who | Document types | What it confirmed or changed | Deleted on |
| ---- | --- | -------------- | ---------------------------- | ---------- |
