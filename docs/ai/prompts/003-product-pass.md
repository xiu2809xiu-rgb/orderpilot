# Prompt 003: Make it feel like a real product

Phase A is merged, and the base is solid underneath. On 1 Nov at 3 am, Richie walked through it as every role, and it looks and feels unfinished. Before the handover on Monday evening, 2 Nov, do this product pass. Then go back to Phase B.

Prompts 001 and 002 still apply. This prompt changes the order and raises the bar. The handover prompt that writes each area's stories is now **prompt 004**.

## 1. What's wrong today

- **The home page is empty.** Every tile shows a dash and "Planned", the subtitle says "Counts appear as each area is built", and "Lists" is a placeholder.
- **The consent card** ("Help us improve OrderPilot") appears on every page and covers the content.
- **The flow has no beginning.** Orders, Documents, Master data, Mapping, Connectors and the 3D view are "Planned" pages. Nobody can see a customer, an item, its stock, an order's lines or a document.
- **The order page is thin.** It shows one step and "No checks", with no lines, amounts, documents, people or actions.
- **The task inbox is two cards in white space.** It has no customer, amount, age or priority, and no action other than "Open order".
- **The data is too small.** Ten orders, five customers and thirty items make every list look empty.
- **Nothing tells a person what to do next.**

## 2. The bar

- **A product, not a scaffold.** Whoever signs in, as any role, sees real numbers, the work waiting for them, and buttons that do something. It runs on synthetic data, but it should feel ready for Spectra's staff on Monday.
- **No placeholder a reviewer can reach.** Hide a menu item until it has something real to show. Keep `PlannedPage` only behind a development flag.
- **Efficient:**
  - every list has its primary action (Upload PO, New order, Raise SPR);
  - every detail page shows the next actions for the signed-in role;
  - Ctrl+K runs actions as well as navigation;
  - "/" focuses search, and "N" starts a new record on lists that have one;
  - every action ends with a toast, with Undo where it can be undone.

  Fewer clicks beats more pages.

- **Dense and calm:**
  - compact table rows (36 to 40 px), with numbers right-aligned in tabular figures and amounts with their currency;
  - skeletons that match the final layout;
  - no large empty cards.

  Keep the UI rules in prompt 001, section 9, and the pattern rules in prompt 002, section 5.

- **Honest mocks.** The "Mock AI", "Mock Navision" and "Synthetic demo data" badges stay.
- **Free kits only.** No Pro code yet (prompt 002, section 4). Use React Bits (free) and Magic UI for the few places that deserve motion, such as the sign-in page, KPI numbers and empty states. Keep work screens still.

## 3. The work, in this order

One story, one issue, one branch, one pull request each, with prompt 002's speed rules. Number the stories after the last P story on the board.

1. **Data that looks real.**
   - Grow `packages/synthetic-data` with the same fictional brands and the brief's countries:
     - about 40 customers and 12 vendors;
     - 300 items across IT, surveillance and accessories, each with a part number, brand, price, stock, quantity on sales order and quantity on purchase order;
     - 120 orders spread across every state over the last 60 days, each with lines, amounts, documents, owners and dates;
     - payments, SPRs, tasks, reminders and exceptions to match.
   - Every area's seed uses it, so the screens agree with each other.
   - Keep the seed deterministic and under 30 seconds.
2. **The consent card.**
   - Make it one small card at the bottom right, shown once per browser and never over content.
   - Remember the choice, and let Settings change it later.
   - Change only its placement and frequency, not area 4's logic. Ask Angelyn to review.
3. **Home pages that work, for every role:**
   - Tiles with real counts from the existing endpoints: my tasks, documents to confirm, open orders, open exceptions, overdue, awaiting approval, awaiting payment and ready to ship. Each tile opens the filtered list.
   - **Needs you:** the role's top five items, with customer, amount and due date, and a one-click action on each.
   - Quick actions for the role.
   - The sales flow as a chain of steps with a live count at each step, and the purchase flow beside it marked phase 2. Clicking a step opens the tracker filtered to that step.
   - For Management: the five KPIs with small trend charts (shadcn charts).
4. **Sign-in that sells it.**
   - A split layout: the form on one side, and OrderPilot's promise on the other. That side has the tagline, the three-step "AI reads, rules decide, people approve" and a subtle animated order flow.
   - Demo sign-in stays one click per role.
5. **Master data (area 1, brought forward from P-19).** Lists and detail pages for customers, vendors and items, read from the mock Navision data and labelled "Mock Navision":
   - an item shows stock, quantity on sales order, quantity on purchase order, available stock, price, brand and vendor;
   - a customer shows country, currency, payment terms, price group, open orders and overdue items;
   - a vendor shows its bank accounts (masked by role) and its open purchase orders.
6. **Orders (area 1).**
   - The orders list, with filters for status, customer, owner, date and amount.
   - A **New order** form: customer, PO number, and lines with item search, quantity and price. It shows availability live as you type, and flags a shortfall with "Raise SPR".
   - Make **one order page** the single place for an order:
     - area 1's header, lines, amounts, availability and documents;
     - area 2's steps;
     - area 3's checks and tracker view;
     - the next actions for the role.

     Each section stays a component in its owner's folder.

   - Writes go to OrderPilot only, never to Navision.
7. **Documents and the review screen (area 1, brought forward from P-18 and P-21).**
   - Upload with drag and drop (PDF, images, Excel), and the documents list.
   - Each document's page shows the preview beside the fields read from it. Each field has its confidence, and clicking a field highlights where it came from on the page.
   - **Confirm** and **Correct** actions, with the corrections audited.
   - Until P-17's gateway is ready, Mock AI fills the fields from the synthetic ground truth.
   - Ship 12 synthetic documents (POs in different layouts, PIs and packing lists, including one scanned-looking PO) in `apps/web/public/demo-documents/`, so anyone can try the demo story's first two steps.
8. **The screens the teammates inherit: UI only, never their logic.**
   - **Task inbox:** a compact list with customer, amount, age, due date and priority, and filters by type. Inline actions (approve, reject with a comment, open), and bulk select where it's safe.
   - **SPR approval:** the request, the stock picture, the customer's order, the approver's limit, and the decision with a comment.
   - **Exceptions:** severity, expected and found side by side, assign, and resolve with a reason.
   - **Insights:** the five KPIs with trend and target, by week.

   Keep every area's core logic as `it.todo` for its owner. In each pull request, say what changed, and ask that area's owner to review.

9. **Hide what isn't real yet.** Remove Mapping, Connectors and the 3D view from the menu until their stories land.

## 4. Check it the way Richie will

Before each pull request merges:

- **Screenshots:** sign in as every role it touches. Take screenshots of the home page and that role's two main pages, at 1440 by 900 and at 390 by 844.
- **Where they go:** save them in `docs/design/screenshots/product-pass/`.
- **Look before merging:** check them yourself. There must be no "Planned", no tiles showing only a dash, no popups over content, no empty-looking lists, and no text cut off.
- **The full set:** put every screenshot in the handover report.

## 5. After this

Go back to Phase B in prompt 002's order, from P-13. Skip anything this prompt already did, and say so in the build report.
