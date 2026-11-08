# ADR 0046: Orders, the samples and the stored rows

- **Status:** Accepted
- **Date:** 2026-11-08
- **Story:** P-36

## Context

The 120 sample orders (`SO-0001` to `SO-0120`) come from `packages/synthetic-data`. Their dates are relative to today, so they are generated again each day and are never copied to the database. P-36 adds the Orders list and the order reader. People will soon make real orders (P-49), and every screen that asks for an order's facts must treat a sample order and a new order alike.

## Decision

1. **Samples stay generated; new orders are real rows.** The 120 samples stay in the synthetic set because their dates move with today. A new order is a row in OrderPilot's own tables (`SalesOrder` and `SalesOrderLine`). Navision is never written: `navisionNo` stays null until the order is posted there (ADR 0007).
2. **A capture state, never a status.** The column `captureState` is `DRAFT`, `SUBMITTED` or `VOID`. It says how far the entry of the order has got. The order's status stays area 2's state machine. A sample order has no capture state, and a stored order has no workflow status, so the directory invents neither.
3. **One port, two sources.** `OrderDirectory` answers for both, behind one composite. Whatever needs an order's facts asks it. The list carries a `source` per row (`sample` or `stored`) and no `meta.mock`, because a stored order is real.
4. **The `SO` prefix.** Stored numbers come from the record number service as `SO-YYYYMMDD-NNNN`. That needs `SO` in the shared `RECORD_TYPES`, which area 2's counter uses. Both patterns are now built from the list, and SPR, PI and EXC are unchanged. A sample number (`SO-0001`) is not a record number, so `parseRecordNumber` tells the two apart, never a prefix test. `ORD` is the named alternative. It would avoid any look-alike, but it cannot be changed once rows exist.
5. **Stored drafts are never demand.** A stored order does not change Navision's `qtyOnSalesOrder` and is not counted as stock demand. Its shortage is worked out per line at read time against the available stock, each order on its own. Stored orders do not take stock from each other.
6. **Amounts use the existing price rule.** The amount is masked with `item.unitPrice` (Warehouse and Logistics see dots, reason "price"). Area 4 may replace it with an `order.amount` rule.
7. **An in-memory merge, with a bound.** The list merges the 120 samples with the stored rows in memory, as master data does. The count comes from SQL. The stored read has a hard `MAX_STORED_READ` of 2000, and the repository throws a `DomainError` when it is hit, never cutting the list silently. Past about 2000 stored rows, the plan is a keyset page in SQL, filtered and sorted by the database, with the samples merged in front.
8. **Audit convention for P-49.** Entity type "Order", entity id the order number, and no price in any summary. P-36 only reads, and the guard audits refusals.
9. **Deferred.** The status filter, the owner filter and brand scope for Product Managers. Stored orders have no status and no owner yet, and the user-to-brand mapping is not confirmed.

## Alternatives considered

- **Copying the samples into the tables.** Rejected: the dates would go stale, and the database would hold data that is not OrderPilot's.
- **A derived "submitted" for samples.** Rejected: it would invent a fact.
- **A unique index on customer and PO number.** Deferred to P-49. The index is not unique for now, because a revised PO may keep its number.
- **Stored orders counted as demand in sequence.** Rejected: it would make a draft move stock figures.

## Consequences

- The tracker and the checks still read the sample dataset, so a stored order is absent from them until areas 2 and 3 adopt `ORDER_DIRECTORY`. A stored row has no link in the list meanwhile.
- Rolling back a transaction rolls the number counter back with it, so no number is burned. A test asserts it.
- The stored half of the list is read in full each time, within the bound above.
