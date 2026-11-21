import type {
  ItemQuery,
  ItemRow,
  MaskedField,
  Role,
  SalesOrderDetail,
  SalesOrderQuery,
  SalesOrderRow,
} from "@orderpilot/shared";
import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../common/domain-error.js";
import type {
  ReadOnlyTool,
  ToolContext,
} from "../../ai/domain/read-only-tool.js";
import type { MasterDataService } from "../../master-data/master-data.service.js";
import type { OrdersService } from "../../orders/orders.service.js";
import { SparkRun } from "../spark-run.js";
import { SPARK_TOOL_NAMES, SparkToolset } from "../spark-toolset.js";
import { checkStockTool } from "./check-stock.tool.js";
import { findOrdersTool } from "./find-orders.tool.js";
import { getOrderTool } from "./get-order.tool.js";

const hidden: MaskedField = {
  field: "item.unitPrice",
  classification: "confidential",
  masked: true,
  value: null,
  reason: "price",
};

const itemRow = (no: string): ItemRow => ({
  no,
  description: "HP Monitor 24-inch",
  partNumber: "PN-1",
  brand: "HP",
  category: "PERIPHERALS",
  baseUnitOfMeasure: "PCS",
  inventory: "880",
  qtyOnSalesOrder: "6",
  qtyOnPurchOrder: "146",
  availableStock: "1020",
  availability: "ok",
  unitPrice: hidden,
  vendorNo: "V-0001",
  vendorName: "A Vendor",
});

const orderRow = (orderNo: string): SalesOrderRow => ({
  orderNo,
  source: "sample",
  captureState: null,
  customerNo: "C-0001",
  customerName: "Acme",
  externalDocumentNo: "PO-1",
  orderDate: "2026-11-02",
  shipmentDate: null,
  workflowStatus: "Open",
  amount: hidden,
  currencyCode: "USD",
  shortage: null,
  shortageCount: 0,
});

const context = (role: Role): ToolContext => ({
  actor: { userId: "u-1", role },
  traceId: "t-1",
  signal: new AbortController().signal,
});

async function runTool(
  tool: ReadOnlyTool,
  input: unknown,
  role: Role,
): Promise<unknown> {
  return tool.execute(tool.inputSchema.parse(input), context(role));
}

describe("check_stock", () => {
  it("asks the master data reader as the person's role, for at most five items, and records what it looked at", async () => {
    // Typed with both parameters, so the test can read the role it was called with.
    const listItems = vi.fn<(query: ItemQuery, role: Role) => Promise<unknown>>(
      (query) =>
        Promise.resolve({
          items: [itemRow("I-0025")],
          page: query.page,
          pageSize: query.pageSize,
          total: 1,
        }),
    );
    const run = new SparkRun();
    const tool = checkStockTool(
      { listItems } as unknown as MasterDataService,
      run,
    );
    const result = await runTool(tool, { search: " HP Monitor " }, "WAREHOUSE");

    expect(listItems).toHaveBeenCalledTimes(1);
    const [query, role] = listItems.mock.calls[0] ?? [];
    expect(role).toBe("WAREHOUSE");
    expect(query).toMatchObject({ search: "HP Monitor", page: 1, pageSize: 5 });
    expect(result).toMatchObject({ found: true, matched: 1 });
    expect(run.sources).toEqual([
      { kind: "item", id: "I-0025", label: "Item I-0025, HP Monitor 24-inch" },
    ]);
    expect(tool.permission).toBe("orders.read");
  });

  it("answers an empty search as a plain result and records nothing", async () => {
    const run = new SparkRun();
    const tool = checkStockTool(
      {
        listItems: () =>
          Promise.resolve({ items: [], page: 1, pageSize: 5, total: 0 }),
      } as unknown as MasterDataService,
      run,
    );
    expect(await runTool(tool, { search: "nothing" }, "SUPPORT")).toEqual({
      found: false,
      message: "No item matches that search.",
    });
    expect(run.sources).toEqual([]);
  });

  it("refuses an empty or oversized search before it reads anything", () => {
    const tool = checkStockTool({} as MasterDataService, new SparkRun());
    expect(tool.inputSchema.safeParse({ search: "  " }).success).toBe(false);
    expect(tool.inputSchema.safeParse({ search: "x".repeat(61) }).success).toBe(
      false,
    );
    expect(tool.inputSchema.safeParse({}).success).toBe(false);
  });
});

describe("find_orders", () => {
  it("lists the ten most recent as the person's role, passing only the filters it was given", async () => {
    const list = vi.fn<
      (query: SalesOrderQuery, role: Role) => Promise<unknown>
    >((query) =>
      Promise.resolve({
        items: [orderRow("SO-0001"), orderRow("SO-0002")],
        page: query.page,
        pageSize: query.pageSize,
        total: 2,
      }),
    );
    const run = new SparkRun();
    const tool = findOrdersTool({ list } as unknown as OrdersService, run);
    await runTool(
      tool,
      { customerNo: "C-0001", waitingForStock: true },
      "FINANCE",
    );
    const [query, role] = list.mock.calls[0] ?? [];
    expect(role).toBe("FINANCE");
    expect(query).toMatchObject({
      customerNo: "C-0001",
      stock: "waiting",
      page: 1,
      pageSize: 10,
      sort: "orderDate",
      direction: "desc",
    });
    expect(query?.search).toBeUndefined();
    expect(run.sources.map((s) => s.id)).toEqual(["SO-0001", "SO-0002"]);
    expect(tool.permission).toBe("orders.read");
  });

  it("sends no filter at all when it was given none", async () => {
    const list = vi.fn(() =>
      Promise.resolve({ items: [], page: 1, pageSize: 10, total: 0 }),
    );
    const tool = findOrdersTool(
      { list } as unknown as OrdersService,
      new SparkRun(),
    );
    expect(await runTool(tool, {}, "SUPPORT")).toEqual({
      found: false,
      message: "No order matches that search.",
    });
    const [query] = list.mock.calls[0] as unknown as [SalesOrderQuery];
    expect(query.stock).toBeUndefined();
    expect(query.customerNo).toBeUndefined();
  });
});

describe("get_order", () => {
  const detail = (orderNo: string): SalesOrderDetail => ({
    ...orderRow(orderNo),
    prepaymentPercent: "0.00",
    navisionNo: null,
    version: null,
    lines: [],
  });

  it("reads one order as the person's role and records it", async () => {
    const one = vi.fn<(orderNo: string, role: Role) => Promise<unknown>>(
      (orderNo) => Promise.resolve(detail(orderNo)),
    );
    const run = new SparkRun();
    const tool = getOrderTool({ one } as unknown as OrdersService, run);
    const result = await runTool(tool, { orderNo: " SO-0001 " }, "LOGISTICS");
    expect(one).toHaveBeenCalledWith("SO-0001", "LOGISTICS");
    expect(result).toMatchObject({ found: true });
    expect(run.sources).toEqual([
      { kind: "order", id: "SO-0001", label: "Order SO-0001" },
    ]);
  });

  it("answers an unknown order as a plain result, so the model can tell a typo from an outage", async () => {
    const run = new SparkRun();
    const tool = getOrderTool(
      {
        one: () => Promise.reject(new NotFoundError("Order")),
      } as unknown as OrdersService,
      run,
    );
    expect(await runTool(tool, { orderNo: "SO-9999" }, "SUPPORT")).toEqual({
      found: false,
      message: "There is no order with that number.",
    });
    expect(run.sources).toEqual([]);
  });

  it("lets any other failure through, for the loop to report as a failed tool", async () => {
    const tool = getOrderTool(
      {
        one: () => Promise.reject(new Error("the database is down")),
      } as unknown as OrdersService,
      new SparkRun(),
    );
    await expect(runTool(tool, { orderNo: "SO-1" }, "SUPPORT")).rejects.toThrow(
      "the database is down",
    );
  });
});

describe("the toolset", () => {
  it("makes exactly the three read-only tools, each asking for one permission the route has", () => {
    const tools = new SparkToolset(
      {} as MasterDataService,
      {} as OrdersService,
    ).forRun(new SparkRun());
    expect(tools.map((tool) => tool.name)).toEqual([...SPARK_TOOL_NAMES]);
    expect(tools.map((tool) => tool.name)).toEqual([
      "check_stock",
      "find_orders",
      "get_order",
    ]);
    expect(tools.every((tool) => tool.permission === "orders.read")).toBe(true);
  });

  it("binds each set of tools to its own run, so two questions never share what they looked at", async () => {
    const toolset = new SparkToolset(
      {} as MasterDataService,
      {
        one: (orderNo: string) => Promise.resolve(detailFor(orderNo)),
      } as unknown as OrdersService,
    );
    const first = new SparkRun();
    const second = new SparkRun();
    const getFirst = toolset.forRun(first)[2];
    await getFirst?.execute({ orderNo: "SO-0001" }, context("SUPPORT"));
    expect(first.sources).toHaveLength(1);
    expect(second.sources).toHaveLength(0);
  });
});

function detailFor(orderNo: string): SalesOrderDetail {
  return {
    ...orderRow(orderNo),
    prepaymentPercent: "0.00",
    navisionNo: null,
    version: null,
    lines: [],
  };
}
