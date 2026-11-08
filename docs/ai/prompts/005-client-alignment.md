# Prompt 005: Build what Spectra told us on 5 Nov

On 5 Nov Spectra briefed all the teams. The client pack on Richie's PC now holds:

- the full meeting notes (file 07);
- the screenshots (file 08), including the sketch of the tool they picture and its chat assistant, Spark;
- our team's write-up of what changes (file 09).

Read all three under the pack README's rules before planning.

Prompts 001 to 004 still apply, except where this prompt changes them. **Order:** finish the stories in flight (P-45, then P-47) first, then follow section 12. **Handover:** the handover prompt is now **006**.

The aim is to stand out: other teams heard the same briefing. **Our edge is the quality of the build:**

- Spark works on realistic data.
- Every document is checked exactly against the others.
- An audit pack takes seconds.
- The UI is a generation ahead of the tools Spectra uses today.

## 1. What changed

1. **The ERP is Microsoft Dynamics 365 Business Central, in the cloud.** Spectra moved off Navision.
   - **Rename "Navision" to "Business Central"** across the UI, the docs, CLAUDE.md and AGENTS.md, and in code names where the rename is cheap. Pages show "Managed in Business Central".
   - **The mock becomes "mock Business Central".** It follows the resource names and JSON shapes of Business Central's standard API v2.0: companies, customers, vendors, items, salesQuotes, salesOrders, salesInvoices, purchaseOrders and purchaseInvoices, with their lines. Check Microsoft's API reference for the exact shapes.
   - **Webhooks (subscriptions) come later.**
   - **Switching to the real Business Central must be configuration only:** base URL, tenant, environment, company and OAuth client. No code changes.
2. **SPR means Stock Purchase Requisition.**
   - **Raising it:** the product manager raises it. At Spectra, the product manager and the purchase manager are the same person. The request is based on stock on hand and the last three months' run rate.
   - **Routing:** a coordinator (a Support user) routes it to the management approver group. The group has three people, and any one of them decides, so no substitutes are needed.
   - **Reminders:** if no one decides within 24 hours, the whole group gets an email asking them to approve, or to reply with remarks.
   - **Tracking:** the product manager must always see exactly where the SPR is stuck.
   - **After approval:** the coordinator hands it back to the product manager, who places the vendor PO. Some vendors make Spectra enter POs in the vendor's own portal; record that portal's reference instead.
3. **There is no sales-side approval today,** because one person buys and sells each product line. Keep the capability, switched off by default.
4. **Zero tolerance.**
   - **What must match:** part number, quantity, unit price and currency must match exactly across the PO, PI, invoice and packing list. Customer and vendor are never the mismatch. No tolerance setting for these four.
   - **When to catch it:** before the PI or the invoice is issued.
   - **After issue:** the only fix is to reverse and reissue (a credit note, then a new invoice). Model that with a reason and an audit entry.
5. **They only sell what they have.** When a PO asks for more than is available:
   - hold the order;
   - draft a request asking the customer to revise the PO to the available quantity at the PO's price;
   - match the revised PO as version 2 of the same order.

   No partial shipments or back orders by default.
6. **Changes after the PO are rare.** More than 95% of orders are settled before the PO arrives. A revised PO is a new version, shown with its differences.
7. **Documents are almost all PDFs,** arriving by email and WhatsApp. Product managers upload vendor invoices themselves.
   - **Intake for the POC:** an email inbox, upload, and files saved out of WhatsApp.
   - **A live WhatsApp number is later.**
8. **Customer check on intake.**
   - Match the PO's customer against the customers in Business Central, by name, address and tax ID.
   - When the customer is new, a pre-filled customer card goes for approval, then into mock Business Central.
   - Any write to Business Central keeps its preview and approval, as CLAUDE.md says.
9. **Prices are individual and agreed before the PO.** They vary with credit or cash terms, volume and loyalty, and rebates are built into the invoice.
   - **So the PO price is the agreed price,** and the check is that the documents agree.
   - **Build no price tables.** Show the customer's last agreed price for the item as context only.
10. **Spectra said there are no restrictions on AI processing for the POC.** That was on the recording of 5 Nov, and we're asking for it in one written line with our data request.
    - **Update A-31:** their samples may go to cloud AI that doesn't train on inputs once that written line arrives. Until then, use the mock AI.
    - **Samples stay out of Git,** in `samples/` and the client pack.
11. **Their success measures, in their order:**
    1. processing time;
    2. seeing where each order is held up;
    3. fewer errors.

    Their targets are about an hour saved a day, and audits that take minutes instead of days. So the KPIs become:
    - PO received to PI sent;
    - PO received to shipped;
    - time stuck at each step;
    - mismatches caught before anything is issued;
    - time to produce an audit pack;
    - time to decide an SPR.
12. **The users are:**
    - sales and purchasing (often the same person for a product line);
    - finance;
    - the warehouse and logistics in Jurong (the office is at Henderson Road);
    - the management approvers;
    - the SPR coordinator;
    - auditors.

## 2. Richie's decisions

- **The assistant is called Spark,** Spectra's own name for it. Give it an icon of our own.
- **Demo data uses real brand names Spectra carries,** such as Dell, HP, Lenovo, Samsung, Intel, Acer, Asus, Seagate, Toshiba, Kioxia, Lexar, Verbatim, TeamGroup, Cooler Master, Hikvision, TP-Link, Cudy, Aruba, HPE, Supermicro, Vertiv and Honeywell.
  - Part numbers are made up, in each brand's style.
  - No logos anywhere.
- **Pricing stays simple,** as point 9 above says.
- **Customer inquiries go through Spark** ("Do we have 1,000 of these? Draft a reply."). There is no inquiry module.
- **WhatsApp in the POC means saved files,** uploaded or forwarded.
- **The purchase flow moves forward from phase 2** (section 9), because Spectra ranks it equal with sales.

## 3. Spark

- **Where it lives:**
  - a side panel that opens from anywhere, from a button in the top bar or a shortcut that doesn't clash with Ctrl+K;
  - a full page.

  It keeps each person's conversations.
- **When the panel is empty,** suggest prompts in Spectra's own words:
  - "Match ABC's invoice, packing list and AWB."
  - "Collect all of ABC's invoices, packing lists and AWBs for October."
  - "Seagate's sales for the past 6 months as a graph."
- **Tools, all read-only:**
  1. **Find documents** by customer, vendor, PO number, type, date range or status, with full text and fuzzy part-number search (pgvector and pg_trgm are already in the stack).
  2. **Match a set** (PO, PI, invoice, packing list, AWB/BL) and explain each mismatch, linking to both pages.
  3. **Collect an audit pack** (section 4).
  4. **Answer order questions:**
     - Where is order X?
     - What's waiting for me?
     - What has been stuck for more than N hours?
  5. **Analytics as charts:**
     - sales by brand, item, customer or destination country, by month;
     - PO-to-delivery time by vendor.
  6. **A 6-month forecast** by customer, item or brand, with the range shown and the method explained in a sentence.
  7. **Check stock and draft a reply** to a customer's inquiry. The reply is a draft only.
- **Rules:**
  - Spark never approves, posts, pays, sends or changes anything. Its drafts go to a person.
  - Every answer cites its sources: links to documents and orders, or the query behind a chart.
  - It sees only what the person asking may see, through the same permission checks as the API.
  - Every question and answer is audited.
  - Outside its tools, it says what it can't do.
- **How it's built:**
  - It runs through P-17's LLM gateway, with tool calling.
  - The tools call our own services. The model never writes raw SQL.
  - Charts are drawn by our chart components from the tools' results.
  - A deterministic mock provider, with scripted answers to the demo questions, keeps tests and offline demos working.

## 4. The document cabinet and audit packs

- **Filing on arrival.** Every document is filed when it arrives, with the fields the AI read (type, company, PO number, document number, date, amount, status) and a link to its order.
- **The cabinet page:**
  - one search box, plus filters for company, PO number, document type, date, status and who stored it;
  - a results grid;
  - a related-documents chain for each PO;
  - a viewer with zoom, page thumbnails, stamps such as Checked and Verified (with who and when), and notes;
  - a match badge on every pair of documents.
- **Audit packs.**
  - **Pick a scope:** a customer, a vendor, a month or an order.
  - **Download:** a zip of every document, plus an index PDF showing what each one is, when it came in and who checked it.
  - **Every download is logged.**
- **Storage.** Documents live in OrderPilot: in MinIO today, and in storage hosted in Singapore once deployed (ADR 0031). Copying to a SharePoint folder is an option for later.
- **The screenshots in the pack show DocuWare.** Take the ideas, never its look (prompt 002, section 5).

## 5. Checks (area 3: the logic is Iok Teck's)

- **Pairs to check:**
  - **PO and PI:** before the PI is sent.
  - **PO and PI against the invoice and packing list:** before the goods are released.
  - **Invoice and packing list against the AWB/BL draft:** consignee, notify party, description, quantities, packages and weights.
- **Severity.**
  - A mismatch on part number, quantity, unit price or currency blocks the next step until it's fixed, or reversed and reissued.
  - Other differences are warnings.
- **Screens:** the two documents side by side, with both values highlighted on their pages. Build them, and ask Iok Teck to review the rules.

## 6. Workflow (area 2: the logic is Azri's)

- **What his workflow now needs:**
  - the SPR flow in point 2;
  - the short-stock revision request;
  - PO versions;
  - reverse and reissue;
  - the purchase steps in section 9.
- **Raise each change with Azri in an issue,** including that his mock's substitute becomes the approver group.
- **Build the platform side:** screens, the 24-hour reminder email on BullMQ, and the "where is it stuck" view. The state machine's rules stay his.

## 7. Controls (area 4: the logic is Angelyn's)

- **What her policy now needs:**
  - the approver group, which replaces substitutes (F-3's limits stay switchable, with none set);
  - a coordinator permission;
  - customer, vendor and price data shown only to the roles that need it;
  - Spark's permission checks;
  - logging of audit-pack downloads.
- **Raise these with Angelyn in an issue,** and build only the platform side.

## 8. Insights (area 3)

- **Product-line health:**
  - monthly sales by brand, item, customer and destination country;
  - stock cover (stock divided by the 3-month run rate);
  - PO-to-delivery time by vendor and brand, promised against actual;
  - the forecast against actuals.
- **The forecast** is simple and explainable, such as seasonal naive or exponential smoothing for each series, with a range. A worker job computes it, on 24 months of synthetic history now and on Spectra's data later.
- **Power BI:**
  - read-only reporting views in PostgreSQL;
  - a sample Power BI file connected by DirectQuery, for near-live figures;
  - a short guide to connecting it.

  The live dashboards in OrderPilot stay the real-time view.

## 9. The purchase flow, brought forward

- **Vendor POs** made from an approved SPR, or a vendor-portal reference.
- **The vendor PI check:** against our PO, and the bank details against the vendor's record, with a hold on any change.
- **Inbound shipments,** with the promised and expected dates, and drafted chase emails when they slip. Lead times now run from 3 to 4 weeks for notebooks up to 6 months for components.
- **Goods receipt:** expected quantities beside what was counted.
- **Inwarding** into mock Business Central after a person confirms.
- **Vendor payments** by due date.

Keep it thin until the sales flow works end to end.

## 10. Synthetic data and documents

- **`packages/synthetic-data`:**
  - real brands from section 2;
  - categories that match Spectra's portfolio (components, peripherals, PCs, enterprise, security, networking);
  - made-up customers in the countries Spectra serves: UAE, Pakistan, Sri Lanka, Maldives, India, Nepal, Bangladesh, Vietnam, Singapore, Indonesia and Malaysia;
  - prices in USD;
  - 24 months of history with seasonality;
  - vendor lead times as in section 9.
- **Planted cases for the demo:**
  - a PO for more than is in stock;
  - one price mismatch between a PO and a PI;
  - one AWB draft with the wrong consignee.
- **Synthetic documents, all as PDFs:** add a vendor PI, a vendor invoice, a packing list, a delivery order, an AWB, a BL (draft and final), proof of payment and the SPR form.
- **When Spectra's samples arrive,** they go only in `samples/`. Use the mock AI first, then cloud AI once A-31's written line is in.

## 11. The UI bar

- **A generation ahead of Spectra's tools,** yet familiar to Business Central users: role home pages, list pages, cards and action bars.
- **Fast, keyboard-first, dense and calm** (prompt 003).
- **Spark one keystroke away.**
- **Approvals that work on a phone,** because the approvers travel.
- **The Pro kits on Richie's pages** once P-22 lands.

## 12. Order of work

1. **Finish P-45 and P-47.**
2. **The facts and renames in sections 1 and 2:** Business Central, SPR, roles, the approver group and zero tolerance. They're small, and everything depends on them.
3. **The synthetic data and documents** (section 10).
4. **The sales flow end to end on the templates:** prompt 004's orders and documents, plus the customer check, the short-stock revision, and the checks before the PI and before release.
5. **The document cabinet and audit packs.**
6. **Spark v1:** find, match, collect and order questions, on the mock provider and the LLM gateway.
7. **The SPR screens and the 24-hour reminder,** then the thin purchase steps.
8. **Insights:** product-line health, the forecast, Spark's charts, and the Power BI views and sample file.
9. **P-22,** as already planned, once the licence keys are in.

Each story gets one issue, one branch and one pull request, with screenshots as prompt 003, section 4 asks. Each area's owner reviews their area's pull requests.

## 13. Record it

- **In `docs/client/questions-for-client.md`,** record the answers from 5 Nov in our own words.
- **In `docs/assumptions.md`,** settle the assumptions the meeting answered, and update A-31 as point 10 describes.
- **Rename the demo personas:**
  - three made-up management approvers replace the current approver persona;
  - add a made-up SPR coordinator.
- **Keep these out of the repository:**
  - the names of Spectra's staff;
  - Spectra's financial figures;
  - customer or vendor names from their documents;
  - the screenshots themselves.
