import { describe, expect, it } from "vitest";
import type { OrderRow } from "./orderRow";
import {
  countStages,
  countViews,
  DEFAULT_QUERY,
  filterOrders,
  parseQuery,
  rangeReversed,
  sortOrders,
  toParams,
  type OrdersQuery,
} from "./ordersQuery";

const row = (orderNo: string, patch: Partial<OrderRow> = {}): OrderRow => ({
  orderNo,
  source: "sample",
  captureState: null,
  customerNo: "C-0001",
  customerName: "Alpha Traders",
  externalDocumentNo: `PO-${orderNo}`,
  orderDate: "2026-11-10",
  shipmentDate: "2026-11-20",
  workflowStatus: null,
  amount: {
    field: "item.unitPrice",
    classification: "confidential",
    masked: false,
    value: "100.00",
    reason: null,
  },
  currencyCode: "USD",
  shortage: null,
  shortageCount: 0,
  status: { code: "sample-awaiting-payment", label: "Waiting for payment" },
  ownerRole: "FINANCE",
  overdue: { overdue: false, daysOverdue: 0, reason: null },
  openExceptions: 0,
  toConfirm: false,
  step: 4,
  ...patch,
});

const late = { overdue: true, daysOverdue: 5, reason: "Late" };
const ROWS = [
  row("SO-1"),
  row("SO-2", { overdue: late, ownerRole: "SUPPORT" }),
  row("SO-3", {
    status: { code: "sample-shipped", label: "Shipped" },
    step: 7,
    openExceptions: 1,
    customerNo: "C-0002",
    customerName: "Beta Stores",
  }),
  row("SO-4", {
    status: { code: "sample-closed", label: "Closed" },
    step: 10,
    shortageCount: 2,
    toConfirm: true,
    orderDate: "2026-10-01",
  }),
];
const WHO = { role: "SUPPORT" as const };
const query = (patch: Partial<OrdersQuery>): OrdersQuery => ({
  ...DEFAULT_QUERY,
  ...patch,
});
const nos = (rows: readonly OrderRow[]) => rows.map((r) => r.orderNo);

describe("the address", () => {
  it("round-trips every filter and leaves the defaults out", () => {
    const wanted = query({
      view: "held",
      search: "alpha",
      customer: "C-0001",
      status: "sample-shipped,sample-awb-overdue",
      stage: "shipped",
      overdue: true,
      exceptions: true,
      stock: true,
      toConfirm: true,
      open: true,
      entry: "draft",
      source: "stored",
      from: "2026-10-01",
      to: "2026-10-31",
      sort: { id: "orderDate", direction: "desc" },
      page: 3,
      pageSize: 50,
    });
    expect(parseQuery(toParams(wanted))).toEqual(wanted);
    expect(toParams(DEFAULT_QUERY).toString()).toBe("");
  });
  it("takes the links the tracker and the home screen already use", () => {
    const parsed = parseQuery(
      new URLSearchParams(
        "status=sample-pi-to-send&open=true&documentToConfirm=true&overdue=true&exceptionsOnly=true&step=poIn",
      ),
    );
    expect(parsed).toMatchObject({
      status: "sample-pi-to-send",
      stage: "processing",
      open: true,
      toConfirm: true,
      overdue: true,
      exceptions: true,
      step: "poIn",
    });
  });
  it("ignores values it does not know, and keeps parameters that are not its own", () => {
    const parsed = parseQuery(
      new URLSearchParams("view=nope&step=nope&size=7&page=-2&from=soon"),
    );
    expect(parsed).toEqual(DEFAULT_QUERY);
    const kept = toParams(
      query({ view: "mine" }),
      new URLSearchParams("order=SO-1&view=all"),
    );
    expect(kept.get("order")).toBe("SO-1");
    expect(kept.get("view")).toBe("mine");
  });
});

describe("the views", () => {
  it("shows Needs me as the orders the signed-in team holds", () => {
    expect(nos(filterOrders(ROWS, query({ view: "mine" }), WHO))).toEqual([
      "SO-2",
    ]);
    expect(
      nos(filterOrders(ROWS, query({ view: "mine" }), { role: undefined })),
    ).toEqual([]);
  });
  it("shows Held up as what is late or has an open exception", () => {
    expect(nos(filterOrders(ROWS, query({ view: "held" }), WHO))).toEqual([
      "SO-2",
      "SO-3",
    ]);
  });
  it("counts a view under the other filters", () => {
    expect(countViews(ROWS, query({ search: "beta" }), WHO)).toEqual({
      all: 1,
      mine: 0,
      held: 1,
    });
  });
});

describe("the filters of the two old pages", () => {
  const run = (patch: Partial<OrdersQuery>) =>
    nos(filterOrders(ROWS, query(patch), WHO));
  it("searches the order, the PO, the customer number and the customer name", () => {
    expect(run({ search: "so-3" })).toEqual(["SO-3"]);
    expect(run({ search: "po-so-2" })).toEqual(["SO-2"]);
    expect(run({ search: "c-0002" })).toEqual(["SO-3"]);
    expect(run({ search: "BETA" })).toEqual(["SO-3"]);
  });
  it("filters by customer number, never by name", () => {
    expect(run({ customer: "C-0002" })).toEqual(["SO-3"]);
  });
  it("filters by stage and by status", () => {
    expect(run({ stage: "shipped" })).toEqual(["SO-3"]);
    expect(run({ stage: "completed" })).toEqual(["SO-4"]);
    expect(run({ status: "sample-closed" })).toEqual(["SO-4"]);
  });
  it("filters by step, overdue, exceptions, stock, documents and open", () => {
    expect(run({ step: "forwarder" })).toEqual(["SO-3"]);
    expect(run({ overdue: true })).toEqual(["SO-2"]);
    expect(run({ exceptions: true })).toEqual(["SO-3"]);
    expect(run({ stock: true })).toEqual(["SO-4"]);
    expect(run({ toConfirm: true })).toEqual(["SO-4"]);
    expect(run({ open: true })).toEqual(["SO-1", "SO-2", "SO-3"]);
  });
  it("filters by entry state, source and order date", () => {
    expect(run({ source: "stored" })).toEqual([]);
    expect(run({ entry: "draft" })).toEqual([]);
    expect(run({ to: "2026-10-31" })).toEqual(["SO-4"]);
    expect(run({ from: "2026-11-01" })).toEqual(["SO-1", "SO-2", "SO-3"]);
  });
  it("filters nothing by a From after its To, and says it is reversed", () => {
    const reversed = { from: "2026-11-10", to: "2026-10-01" };
    expect(rangeReversed(query(reversed))).toBe(true);
    expect(rangeReversed(query({ from: "2026-10-01", to: "2026-11-10" }))).toBe(
      false,
    );
    expect(rangeReversed(query({ from: "2026-11-10" }))).toBe(false);
    expect(run(reversed)).toEqual(["SO-1", "SO-2", "SO-3", "SO-4"]);
    // The same two days the right way round do filter.
    expect(run({ from: "2026-10-01", to: "2026-10-31" })).toEqual(["SO-4"]);
  });
  it("counts the stages under the other filters", () => {
    const counts = countStages(ROWS, query({ search: "alpha" }), WHO);
    expect(counts.all).toBe(3);
    expect(counts.processing).toBe(2);
    expect(counts.completed).toBe(1);
  });
});

describe("the order of the rows", () => {
  it("puts the most overdue first, then the newest, when no sort is chosen", () => {
    expect(nos(sortOrders(ROWS, null))).toEqual([
      "SO-2",
      "SO-1",
      "SO-3",
      "SO-4",
    ]);
  });
  it("sorts a column both ways and keeps a missing value last", () => {
    const rows = [
      row("SO-1", { shipmentDate: "2026-11-05" }),
      row("SO-2", { shipmentDate: null }),
      row("SO-3", { shipmentDate: "2026-11-01" }),
    ];
    const asc = sortOrders(rows, { id: "shipmentDate", direction: "asc" });
    const desc = sortOrders(rows, { id: "shipmentDate", direction: "desc" });
    expect(nos(asc)).toEqual(["SO-3", "SO-1", "SO-2"]);
    expect(nos(desc)).toEqual(["SO-1", "SO-3", "SO-2"]);
  });
  it("does not sort by a value the role may not see", () => {
    const hidden = (no: string, value: string) =>
      row(no, {
        amount: {
          field: "item.unitPrice",
          classification: "confidential",
          masked: true,
          value: null,
          reason: "price",
        },
        orderDate: value,
      });
    const rows = [hidden("SO-1", "2026-11-01"), hidden("SO-2", "2026-11-02")];
    expect(nos(sortOrders(rows, { id: "amount", direction: "desc" }))).toEqual([
      "SO-1",
      "SO-2",
    ]);
  });

  it("reads the addresses the old Orders list made", () => {
    const query = parseQuery(
      new URLSearchParams(
        "customerNo=C-0002&captureState=draft&source=stored&orderDateFrom=2026-10-01&orderDateTo=2026-10-31" +
          "&search=po&sort=customerNo&direction=desc&pageSize=50&stock=waiting",
      ),
    );
    expect(query).toMatchObject({
      customer: "C-0002",
      entry: "draft",
      source: "stored",
      from: "2026-10-01",
      to: "2026-10-31",
      search: "po",
      sort: { id: "customerName", direction: "desc" },
      pageSize: 50,
      stock: true,
    });
    expect(parseQuery(new URLSearchParams("sort=captureState")).sort?.id).toBe(
      "entry",
    );
  });

  it("lets a new name win over an old one, and writes only new names", () => {
    const params = new URLSearchParams("customer=C-0009&customerNo=C-0002");
    const query = parseQuery(params);
    expect(query.customer).toBe("C-0009");
    const written = toParams({ ...query, customer: null }, params);
    // Neither name stays, or a cleared filter would come back from the old one.
    expect(written.has("customer")).toBe(false);
    expect(written.has("customerNo")).toBe(false);
  });

  it("keeps the page sizes the old list had, and the one the workspace added", () => {
    for (const size of [10, 25, 50, 100]) {
      expect(
        parseQuery(new URLSearchParams(`size=${String(size)}`)).pageSize,
      ).toBe(size);
    }
    expect(parseQuery(new URLSearchParams("size=7")).pageSize).toBe(25);
  });

  it("sorts by the entry state with an order that has none last", () => {
    const rows = [
      row("SO-1"),
      row("SO-2", { source: "stored", captureState: "submitted" }),
      row("SO-3", { source: "stored", captureState: "draft" }),
    ];
    expect(nos(sortOrders(rows, { id: "entry", direction: "asc" }))).toEqual([
      "SO-3",
      "SO-2",
      "SO-1",
    ]);
    expect(nos(sortOrders(rows, { id: "entry", direction: "desc" }))).toEqual([
      "SO-2",
      "SO-3",
      "SO-1",
    ]);
  });
});
