# Prompt 002: Finish the base by Sunday night

Prompt 001 (`docs/ai/prompts/001-build-the-base.md`) is still the brief. This prompt changes only:

- the order and the pace;
- a few decisions;
- and it adds domain notes.

Where the two disagree, this one wins. Every rule in 001 about quality, data, keys, attribution and em dashes still holds.

## 1. Richie's answers to your open points on P-1

1. **Merge P-1 now** (#3). Keep merging with `--author-email 312607067+xiu2809xiu-rgb@users.noreply.github.com` until Richie confirms that Keep my email addresses private is on.
2. **The second ruleset** `protect-main` (id 26237858): Richie deletes it himself. Check that it's gone, then keep and mirror only **Protect main**.
3. **The old board:**
   - Rename it to `OrderPilot delivery (port attempt)` and close it. Don't remove or edit its items.
   - P-2 creates a fresh **OrderPilot delivery** board and puts #1 and #2 on it.
4. **The earlier repositories** stay as they are. ADR 0002 is right as written.
5. **Node:** keep using your portable 24.22.0 until Richie upgrades his own.
6. **The empty `001-build-the-base.md` in the top folder** is a leftover. Richie deletes it. Never commit it: the real prompt is `docs/ai/prompts/001-build-the-base.md`.
7. **This prompt:** move it to `docs/ai/prompts/002-finish-the-base-by-sunday.md` in your next pull request, and add its row to the AI usage log.
8. **Keys stay unread:**
   - Add `Read(./.env)` and `Read(./apps/web/.env.local)` to the `deny` list in `.claude/settings.local.json`.
   - Confirm with `git check-ignore` that the file is ignored.

## 2. The deadline and the pace

The teammates start on their areas on **Monday 2 Nov**, and work on them on Monday, Tuesday and Wednesday nights. So everything in Phase A below is merged by **Sunday 1 Nov, 23:59 Singapore time**.

- **Don't stop between stories.** Merge each pull request the moment its required checks pass, then start the next story straight away. Notes and reports never pause the work.
- **Questions don't block.** When you need Richie's decision:
  - pick the safer option;
  - add the question to a **Waiting for Richie** list at the top of `docs/BUILD_REPORT.md`, and to the pull request;
  - carry on.

  Stop only for something destructive or irreversible, a key only Richie can enter, or a blocker with no way around it.

- **One story per branch and pull request.** A story's tasks are commits on its branch, not branches of their own.
  - Closely related stories may share one pull request, if its title names all of them and it meets every one's acceptance criteria.
  - Each area base (C-1, D-1, F-1, F-2 and G-1) always gets its own pull request.
- **Keep CI busy.** While a pull request's checks run, start the next story on a new branch from `main`. Update it from `main` after the merge.
- **Small and complete beats big and late.** Keep every story's acceptance criteria, but leave out polish no teammate needs this week. Say what you left out in the pull request, and add it to the backlog.
- **Auto mode.** Richie runs you in auto mode. If a safe action is blocked, find a safer way to do it.
- **Usage limits.** If you hit one, first write in the build report exactly where you stopped, so that you or a new session can carry on.

## 3. The new order

### Phase A: by Sunday night (everything a teammate needs)

1. **P-1:** merge #3, and act on section 1.
2. **P-2:** GitHub as code, with the fresh board, and the wiki published. Seed three starter stories for each of areas 2, 3 and 4 (item 8 below).
3. **P-3 and P-4:** the docs, quickly.
   - P-3 adds section 5 of this prompt as `docs/research/domain-notes.md`.
   - P-3 also adds the new questions in section 5.3 to `docs/client/questions-for-client.md`.
4. **P-5:** tooling, plus a **pre-push guard** that refuses any push to `main`. Then the pull request rule holds on every teammate's machine, whatever GitHub enforces.
5. **P-6:** CI and the security baseline.
6. **P-7 to P-12:** the running app.
   - P-9's seed also starts `packages/synthetic-data`: about 5 fictional customers in the brief's countries, 3 vendors, 30 items from fictional brands, opening stock, and 10 orders in different states.
   - Every area base uses this set, and P-19 grows it later.
   - **P-22 (the Pro kits)** comes in here, or as soon as the keys work (section 4).
7. **The area bases:** C-1, D-1, F-1, F-2 and G-1 (prompt 001, section 7), using the notes in section 5.
8. **Starter stories:** three ready-to-pull stories for each of areas 2, 3 and 4, each with its acceptance criteria. The owners refine them, and prompt 003 at the handover writes the rest from their notes.
   - **Area 2 (Azri):**
     - his state machine with the sales flow's states and transitions;
     - SPR approval within limits;
     - reminders and escalations.
   - **Area 3 (Iok Teck):**
     - the packing-list quantity check against the PO;
     - the exceptions queue flow;
     - the tracker's status, owner and overdue flags from workflow events.
   - **Area 4 (Angelyn):**
     - the authorisation policy with approval limits;
     - no self-approval and segregation of duties;
     - the bank-detail hold.
9. **T-1:** as soon as Richie gives the usernames.
10. **The handover report:** in `docs/BUILD_REPORT.md` and in the chat. It covers what each owner gets, how to start, and what is still open.

**Done by Sunday means, for each area:**

- its base is merged, with screens that run on the synthetic data, routes in Swagger, and the `it.todo` tests;
- its guide's "What the base gives you" and "What's yours to build" are filled in;
- its starter stories are on the board;
- Getting started works from a clean clone. It's tested on Windows and written for macOS too, with the `.env` loading and the port settings.

### Phase B: from Monday, on Richie's track (no teammate waits on it)

In order: P-13, P-14, P-15, P-16, P-17 to P-21, P-22 (if not already done in Phase A), P-23, P-24 and P-25.

- **Once an area is handed over, leave its folders alone.**
- **Shared files change in small pull requests,** with the affected owner asked to review.
- **Handover prompt:** prompt 001's T-9 now uses **prompt 003**.

## 4. The UI kits

- **Richie has bought ReUI Pro and React Bits Pro.** Reach for them first. Use a free kit (shadcn/ui, Magic UI, React Bits free, ReUI free) only where it gives a better effect.
- **Setup:** follow each vendor's official docs. The keys are in `apps/web/.env.local` as `REUI_LICENSE_KEY` and `REACTBITS_LICENSE_KEY`; `components.json` refers to them only as `${...}`. Never write a key into a file, commit or message. If the keys aren't in yet, use the free kits for now and add it to **Waiting for Richie**.
- **P-22** runs in Phase A as soon as the keys work.
- **Pro parts stay in Richie's own pages** (landing, sign-in, the app shell and the 3D view), since the licences are in his name. The four areas' screens use the free kits, unless Richie confirms a team licence.

## 5. Domain notes (save as `docs/research/domain-notes.md` in P-3)

These notes are in our own words. They come from:

- Richie's look at a small-business inventory system;
- standard Microsoft Dynamics NAV (Navision).

They inform names, fields and flows only.

- **No copying.** Never copy another product's screens, layout, wording, icons or branding.
- **No screenshots.** Never add screenshots of any other product.
- **Confirm first.** Spectra's Navision may be older or customised. Every Navision detail below is an assumption to confirm at the briefing call.

### 5.1 What standard Navision keeps, and how OrderPilot uses it

| Record              | Fields worth mirroring                                                                                                                                                                                                                                                                                    | Use in OrderPilot                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer            | No., Name, Country/Region Code, Currency Code, Payment Terms Code, Customer Price Group, Credit Limit (LCY), Balance (LCY)                                                                                                                                                                                | Match customers by No., never by name; price checks use the price group                                                                                                      |
| Vendor              | No., Name, Currency Code, Payment Terms Code                                                                                                                                                                                                                                                              | Match vendors by No.                                                                                                                                                         |
| Vendor Bank Account | Code, Name, Bank Account No., SWIFT Code, IBAN                                                                                                                                                                                                                                                            | Area 4 compares the bank details on a vendor PI with these; any difference holds the payment                                                                                 |
| Item                | No., Description, Base Unit of Measure, Unit Price, Unit Cost, Inventory, Qty. on Sales Order, Qty. on Purch. Order, Vendor No., Vendor Item No.                                                                                                                                                          | Available stock is Inventory minus Qty. on Sales Order plus Qty. on Purch. Order; a shortfall suggests an SPR                                                                |
| Sales Header        | No., Sell-to Customer No., External Document No. (the customer's PO number), Order Date, Shipment Date, Currency Code, Prepayment %, Shipment Method Code (shipping terms), Shipping Agent Code (forwarder), Package Tracking No. (AWB/BL), Status (Open, Released, Pending Approval, Pending Prepayment) | The duplicate-PO check uses Sell-to Customer No. plus External Document No.; prepayment fits pay-before-ship; the AWB/BL follow-up fills Package Tracking No. after approval |
| Sales Line          | Type, No., Description, Quantity, Unit Price, Line Amount, Qty. to Ship, Quantity Shipped                                                                                                                                                                                                                 | The PO's lines map one to one                                                                                                                                                |
| Purchase Header     | No., Buy-from Vendor No., Vendor Order No., Vendor Invoice No., Expected Receipt Date, Prepayment %, Status                                                                                                                                                                                               | The vendor PO draft and the receipt checks                                                                                                                                   |
| Posted documents    | Posted Sales Shipment, Posted Sales Invoice, Posted Purchase Receipt                                                                                                                                                                                                                                      | OrderPilot reads them, and never posts                                                                                                                                       |
| Approval User Setup | User ID, Approver ID, Sales Amount Approval Limit, Purchase Amount Approval Limit, Unlimited Sales Approval, Unlimited Purchase Approval, Substitute                                                                                                                                                      | Areas 2 and 4 model approval limits and delegation in the same shape, so a later Navision link maps one to one                                                               |
| No. Series          | The number series for each document type                                                                                                                                                                                                                                                                  | Navision's numbers stay the official ones; OrderPilot shows them beside its own                                                                                              |

- **Look and feel:** newer versions open on a Role Center for each role.
  - It shows tiles ("cues") with counts, such as open orders or orders ready to ship, then lists, cards, and documents with lines.
  - OrderPilot's role home pages use the same idea, in our own design, so Spectra's staff feel at home.
- **Access:**
  - NAV 2009 and later publish pages as SOAP web services, and NAV 2013 and later also as OData. Business Central, its successor, adds a REST API.
  - Our mock Navision speaks OData-style JSON with these names in camelCase.
  - `docs/data-formats.md` uses Navision's names, so Spectra's staff recognise them.

### 5.2 Patterns from a small-business inventory system

| Pattern                                                                                                                                                                                                                                      | Where it goes                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every document has a type prefix, its date and a running number (like `PAY-20261030-00001`), a handler, a department, a summary, notes and attachments                                                                                       | OrderPilot's own records (SPR drafts, PI drafts, exceptions) get numbers like `SPR-20261102-0001`. P-7 and C-1                                                           |
| The home page draws each flow as a chain of documents, with what each changes: a delivery raises receivables and lowers stock, and a receipt lowers receivables; a purchase receipt raises payables and stock, and a payment lowers payables | An order's page in the tracker shows each step and its effect, such as "payment confirmed: packing released". D-1. Money postings stay in Navision                       |
| Payments carry a business type, including prepayment                                                                                                                                                                                         | Payment confirmation records the type, and prepayment drives the payment gate. C-1 and F-1                                                                               |
| Customers and suppliers sit in one list of business partners, each with a type and a price level                                                                                                                                             | The master-data screens and the price checks. P-19 and D-1                                                                                                               |
| A new company starts from opening balances: stock, receivables and payables                                                                                                                                                                  | The synthetic seed starts from opening stock and balances. P-9 and P-19                                                                                                  |
| Staff management with function permissions (which screens and actions), data permissions (which records), copying one user's permissions to another, disabling users rather than deleting them, and desktop or mobile users                  | Area 4's policy: role permissions plus a data scope (for example, a Product Manager sees only their brands' orders); copy a role; users are disabled, never deleted. F-1 |
| An operation log under each record: time, user, IP and what changed                                                                                                                                                                          | The audit trail at the foot of every detail page. P-12 and F-2                                                                                                           |
| An expired session asks the user to sign in again                                                                                                                                                                                            | Refresh tokens. When a session does end, keep unsaved form input and sign back in. P-10 and P-11                                                                         |
| Lists with one quick search across code, name and phone, a "show active only" filter, column settings and Excel export                                                                                                                       | The common data table: quick search, saved filters, column settings, CSV and Excel export. P-12                                                                          |
| Field settings, document configuration and default values for each document type                                                                                                                                                             | Configurable fields and defaults, as configuration, not code. C-1                                                                                                        |
| Replenishment suggestions from stock levels                                                                                                                                                                                                  | The SPR pre-fill: the system suggests, and a person approves. C-1, then area 1                                                                                           |
| Sales returns and purchase returns as their own documents                                                                                                                                                                                    | Not in Spectra's flows yet: a question for the briefing call (5.3)                                                                                                       |
| A first-run guided tour of the menu, and a help assistant labelled as AI-generated and for reference only                                                                                                                                    | Two Could stories under epic E: a first-run tour for each role (useful in the demo), and an "Ask OrderPilot" help panel that answers from our docs, labelled as AI       |
| Stocktakes, write-offs, profit statements and balance sheets                                                                                                                                                                                 | Not OrderPilot: they stay in Navision. Leave them out                                                                                                                    |

### 5.3 New questions for the briefing call

Add these to `docs/client/questions-for-client.md`, after the existing priority questions:

1. Is the PI a pro forma printed from the Navision sales order, or a posted prepayment invoice? Is the customer's payment recorded in Navision?
2. Are approval limits and approvers already set up in Navision, or kept outside it?
3. Where are vendors' bank details kept, and who may change them?
4. Do you record forwarders and AWB/BL numbers in Navision (Shipping Agent, Package Tracking No.)?
5. Does each Product Manager own certain brands, and should they see only those orders?
6. How are returns and credit notes handled, for customers and for vendors?

## 6. Reports

- **End-of-day note:** as prompt 001 asks.
- **The build report's story table:** keep it current.
- **The handover report:** when Phase A is done, then go straight on to Phase B.

## 7. Addendum, 31 Oct evening

Answers for the Waiting for Richie list. Add this message to prompt 002 as section 7, "Addendum, 31 Oct evening", in your next pull request.

a. I'm turning on Keep my email addresses private now. Use the no-reply address for merges once GitHub accepts it.
b. Rule 8 holds: free kits only until I say the repository is private and official keys are in apps/web/.env.local.
c. T-1: MaineJermaine is Azri (area 2), ITnyp is Iok Teck (area 3), angelynnmr is Angelyn (area 4). They are already collaborators. Backup owners: Azri and Iok Teck back each other up, Angelyn backs up area 1, and I back up area 4. Fill in CODEOWNERS.
d. I'm grouping the Backlog view by Sprint myself.
e. I'll upgrade Node later; keep using the portable one.
f. Yes, delete GitHub's default labels with --prune.
g, h, i. Fine as written.
j. Yes, apply the four required checks to the live Protect main ruleset now. If auto mode blocks it, ask me to approve.
k. Done: all three are collaborators, and I'm adding them to the board.

Tech additions. Each one gets an ADR, a pinned version and a row in the traceability matrix:
- Phase A: orval in P-8 and P-11, generating typed TanStack Query hooks and MSW mocks from the Swagger spec, used by every area base. The pgvector/pgvector Postgres image with the pgvector and pg_trgm extensions in P-9. Mailpit in P-9's local stack, as the only place OrderPilot sends email in development and demos.
- Phase B, area 1: the Vercel AI SDK under LlmGateway in P-17, with the gateway keeping cost tracking and the data-to-AI policy. promptfoo for the accuracy set and the prompt-injection tests in CI. React-PDF and ExcelJS for the template engine.
- Area 4 (G-1, and Angelyn's Week 14 to 16 stories): Grafana's otel-lgtm image as an optional compose profile for traces, metrics and logs, and Sentry for errors in the web app and the API. Both stay off unless configured.
- Owners' options, listed in their area guides as options to consider, not built: XState for area 2, json-rules-engine for area 3, CASL and PostHog for area 4.
