# ADR 0046: Orders, the samples and the stored rows

- **Status:** Accepted
- **Date:** 2026-11-08
- **Story:** P-36

## Context

The 120 sample orders (`SO-0001` to `SO-0120`) come from `packages/synthetic-data`. Their dates are relative to today, so they are generated again each day and are never copied to the database. P-36 adds the Orders list and the order reader. People will soon make real orders (P-49), and every screen that asks for an order's facts must treat a sample order and a new order alike.

## Decision

1. **Samples stay generated; new orders are real rows.** The 120 samples stay in the synthetic set because their dates move with today. A new order is a row in OrderPilot's own tables (`SalesOrder` and `SalesOrderLine`). Navision is never written here: `navisionNo` stays null until the order is posted there, and any write-back needs a preview and an approval (capability B of the product brief). The order contract follows Navision's names (ADR 0007).
2. **A capture state, never a status.** The column `captureState` is `DRAFT`, `SUBMITTED` or `VOID`. It says how far the entry of the order has got. The order's status stays area 2's state machine. A sample order has no capture state, and a stored order has no workflow status, so the directory invents neither.
3. **One port, two sources.** `OrderDirectory` answers for both, behind one composite. Whatever needs an order's facts asks it. The list carries a `source` per row (`sample` or `stored`) and no `meta.mock`, because a stored order is real.
4. **The `SO` prefix.** Stored numbers come from the record number service as `SO-YYYYMMDD-NNNN`. That needs `SO` in the shared `RECORD_TYPES`, which area 2's counter uses. Both patterns are now built from the list, and SPR, PI and EXC are unchanged. A sample number (`SO-0001`) is not a record number, so `parseRecordNumber` tells the two apart, never a prefix test. `ORD` is the named alternative. It would avoid any look-alike, but it cannot be changed once rows exist.
5. **A stored order is never stock demand.** No stored order, in any capture state, moves Navision's `qtyOnSalesOrder`. A submitted stored order is listed as an open order in master data (item order lines, a customer's open orders and the open counts), because it still has a quantity to ship. A draft or void one is not listed there. Its shortage is worked out per line at read time against the available stock, each order on its own. Stored orders do not take stock from each other.
6. **Amounts use the existing price rule.** The amount is masked with `item.unitPrice` (Warehouse and Logistics see dots, reason "price"). Area 4 may replace it with an `order.amount` rule.
7. **An in-memory merge, with a bound.** The list merges the 120 samples with the stored rows in memory, as master data does. The count comes from SQL. The stored read has a hard `MAX_STORED_READ` of 2000, and the repository throws a plain `Error` when it is hit, never cutting the list silently. The exception filter logs the detail against the trace id and gives the caller only the standard internal error, so no internal limit is shown. A request that filters by `source=sample` does not read the stored rows at all. The bound is a hard stop for the whole list, and for the master data pages that read the directory, until the SQL page exists. Past about 2000 stored rows, the plan is a keyset page in SQL, filtered and sorted by the database, with the samples merged in front.
8. **Audit convention for P-49.** Entity type "Order", entity id the order number, and no price in any summary. P-36 only reads, and the guard audits refusals.
9. **Deferred.** The status filter, the owner filter and brand scope for Product Managers. Stored orders have no status and no owner yet, and the user-to-brand mapping is not confirmed.

## Alternatives considered

- **Copying the samples into the tables.** Rejected: the dates would go stale, and the database would hold data that is not OrderPilot's.
- **A derived "submitted" for samples.** Rejected: it would invent a fact.
- **A unique index on customer and PO number.** Deferred to P-49. The index is not unique for now, because a revised PO may keep its number.
- **Stored orders counted as demand in sequence.** Rejected: it would make a draft move stock figures.

## Consequences

- Criterion 3 holds for the Orders list, the order reader and master data's sales order listing. These consumers still read the synthetic set directly, and each is out of P-36's scope until its owner adopts `ORDER_DIRECTORY`. A stored order is absent from all of them meanwhile. A stored row has no link in the list either.
  - **Area 3:** the checks (`checks.module`, the mock checks repository, the mock order status reader) and the tracker service.
  - **Area 2:** the workflows read model, the workflows seed and the task sweep.
  - **Area 4:** the policy service and the monitoring mock.
  - **Area 3, insights:** the KPI controller and its mock KPIs.
  - **Area 1, the master-data reader's own figures:** `mock-navision-master-data` still serves items, purchase orders, SPRs and its retained `salesOrders()` port method from the synthetic set. Its stock figures never include a stored order (decision 5).
- The list shows each row's customer name beside the number. A sample has its name in the synthetic set. A stored order has none, so the service asks master data for it by the number, never by name.
- `StockLookup` reads every item to judge a few lines. That is noted for P-20, where the connector gets a by-number read.
- Rolling back a transaction rolls the number counter back with it, so no number is burned. A test asserts it.
- The stored half of the list is read in full each time, within the bound above.
