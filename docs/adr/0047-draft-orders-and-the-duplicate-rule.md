# ADR 0047: Draft orders and the duplicate rule

- **Status:** Accepted
- **Date:** 2026-11-09
- **Story:** P-49

## Context

P-49 lets Support and a Product Manager make an order and edit it while it is a draft. Criterion 3 says one customer plus one PO number is one order, with a unique index and a 409 that names the existing order. ADR 0046 left the index non-unique until this story, because a revised PO might keep its number.

## Decision

1. **The rule.** One live order per customer and PO number. The key is the customer's Navision number plus the PO number, upper-cased, with the spaces collapsed by the service before it is stored. A void order is not live, so a void frees the pair. It is a partial unique index, `SalesOrder_live_customer_po_key`, on `("customerNo", upper("externalDocumentNo")) WHERE "captureState" <> 'VOID'`. The database decides, so two requests at once cannot both win.
2. **Stored orders only.** The 120 sample orders are generated and never stored, and the demo PDFs print sample PO numbers. A sample's PO number is therefore no duplicate, or an uploaded demo document would always get a 409.
3. **A revised PO is a known limit.** A customer's revised PO that keeps its number is not stored as a second order. The 409 links to the live order. A draft is edited in place, and a submitted order needs cancelling (P-50) or a changed number. The 5 Nov briefing says a revised PO becomes version 2 of the same order. That is planned with prompt 005's sales-flow step, so until then a draft is edited in place and the 409 stays for a true duplicate.
4. **The 409 names the order.** The error envelope is unchanged. Its `details` hold two issues: one on `externalDocumentNo` with the message, and one whose path is `existingOrderNo` and whose message is the order number. The shared package exports the path and a reader, so the form links to the order.
5. **A version column.** `SalesOrder.version` starts at 1 and goes up by one on every save of a draft. A save sends the version it was typed against, and the update is guarded on it, so a stale form gets a plain 409 and never overwrites. An `updatedAt` guard was rejected: it is rewritten by every write and a form cannot hold a timestamp to the millisecond safely.
6. **Draft only, and void only for a draft.** A submitted or void order is refused with a 409. P-49 voids drafts only, and P-50 widens the route to cancelling a submitted order with a reason.
7. **No empty drafts.** An order has at least one line, so a draft always has something to show.
8. **No scope rule.** Any Support user or Product Manager may edit any draft, because no brand data exists yet. An own-draft check is the alternative, and it is a decision for Richie.
9. **Stock is fetched every 30 seconds.** Each line shows mock Navision's available stock, from the same formula as master data, refreshed every 30 seconds. A draft reserves nothing.
10. **The PO sets the price.** The 5 Nov briefing settled it: the customer's PO price is the agreed price, and the PO, PI, invoice and packing list must match it exactly. Master data's price is context only. Picking an item leaves the line's price empty, and the form shows the item's list price beside it, labelled for reference. A role that sees prices types the price from the PO, and the server requires it.
11. **A masked writer.** A role that may write an order but may not see prices (a grant made by the policy owner) cannot send a price. It keeps a stored price only for a line whose position and item both match the stored line, so two lines of one item keep two prices. Any other line from such a role is a 400 on `lines.N.unitPrice`, asking for the price to be entered by a role that can see prices. There is no list-price fallback. The answer is masked as every read is.
12. **A total that fits.** Each line is held to 15 whole digits, and so is the order total, which is a sum of up to 200 lines. An order whose total is not a valid decimal string is a 400 on `lines`, raised in the draft-line mapping and again by the `SalesOrder` class, so the list's amount sort and filter never meet a total they cannot compare.
13. **The draft rule comes before the version.** An edit or a void of an order that is not a draft is refused with the draft rule's words, whatever version the form holds, so a closed order is never reported as changed by someone else.
14. **What the audit keeps.** An edit is audited by the names of the fields sent, the number of lines and the two versions, never by a price. A price change on a draft therefore leaves no before and after value, which keeps prices out of the trail by design. The order's own versions are the record that it moved.

## The migration check

Prisma cannot declare an expression index or a partial index, so the migration is written by hand. A later `prisma migrate dev` could propose to drop it, so the check was run on the migrated database (`orderpilot_p49`), with Prisma 7.9.1:

```
prisma migrate diff --from-config-datasource --to-schema prisma/schema --exit-code
```

The real output was `No difference detected.` and the exit code was 0. With `--script` it printed `-- This is an empty migration.` So Prisma does not propose a drop, and the fallback (a nullable `activePoKey` under a plain unique) is not needed. A database test reads `pg_indexes` and fails if the index or its predicate goes missing, so a drop in a later migration is caught.

## Alternatives considered

- **A revision column in the key.** Rejected for now: it needs a decision on what a revision is, and criterion 3 says one customer and one PO number is one order.
- **A plain unique constraint.** Rejected: a void order would hold its number for ever.
- **A typed field on the error envelope.** Rejected: the envelope stays one shape, and `details` already carries per-field issues.
- **Polling each item on its own.** Rejected: one request for all the lines on a page, from the same formula as master data.
- **Checking the sample orders too.** Rejected, as in decision 2.

## Consequences

- The migration builds a unique index, so it fails on a database that already holds two live orders for one customer and PO number. None can exist before this story, because nothing wrote orders: the 120 samples are generated, not stored. Only a test database left by an interrupted run can hold one, as the next point says.
- A test database left by an interrupted run of the sales order tests may hold duplicate rows. The migration would then fail on it, so drop the test database and let the setup make it again.
- Developers who run `pnpm dev` have no stored orders to clash, and run `pnpm db:seed` once. Compose seeds again by itself.
- P-50 copies an order without the PO number, or the first save gets a 409. P-50 also widens the void. P-51 replaces the element at `/orders/:orderNo`. P-55 voids its draft in its test, or a rerun gets the 409.
- The two new permissions, `orders.create` and `orders.edit`, are never held by System admin. Area 4 reviews the four single lines that add them.
