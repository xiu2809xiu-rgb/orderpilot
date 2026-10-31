import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import {
  checkResultSchema,
  exceptionSchema,
  orderTimelineSchema,
  trackerOrderSchema,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../common/domain-error.js";
import { lookAlikes } from "./domain/name-match.js";
import { ExceptionsService } from "./exceptions.service.js";
import { MockChecksRepository } from "./mock-checks.repository.js";
import { MockOrderStatusReader } from "./mock-order-status-reader.js";
import { TrackerService } from "./tracker.service.js";

const dataset = createSyntheticDataset();
const repo = new MockChecksRepository(dataset);
const reader = new MockOrderStatusReader(dataset);
const tracker = new TrackerService(repo, reader);
const exceptions = new ExceptionsService(repo);

function firstOrder() {
  const order = dataset.orders[0];
  if (!order) throw new Error("The dataset has no orders");
  return order;
}

describe("the tracker over mock data", () => {
  it("pages on the server and reports the total", async () => {
    const first = await tracker.list({ page: 1, pageSize: 3 });
    const second = await tracker.list({ page: 2, pageSize: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.total).toBe(dataset.orders.length);
    expect(second.items[0]?.orderNo).not.toBe(first.items[0]?.orderNo);
    for (const row of first.items) trackerOrderSchema.parse(row);
  });

  it("searches by order number", async () => {
    const some = firstOrder();
    const byNo = await tracker.list({
      page: 1,
      pageSize: 25,
      search: some.header.no.toLowerCase(),
    });
    expect(byNo.items.map((o) => o.orderNo)).toContain(some.header.no);
    const none = await tracker.list({
      page: 1,
      pageSize: 25,
      search: "no-such-order",
    });
    expect(none.total).toBe(0);
  });

  it("sorts in both directions", async () => {
    const query = { page: 1, pageSize: 200, sort: "orderNo" as const };
    const asc = await tracker.list({ ...query, direction: "asc" });
    const desc = await tracker.list({ ...query, direction: "desc" });
    expect(asc.items.map((o) => o.orderNo)).toEqual(
      desc.items.map((o) => o.orderNo).reverse(),
    );
  });

  it("filters overdue orders", async () => {
    const overdue = await tracker.list({
      page: 1,
      pageSize: 25,
      overdue: "true",
    });
    expect(overdue.total).toBeGreaterThan(0);
    expect(overdue.items.every((o) => o.overdue.overdue)).toBe(true);
  });

  it("builds a timeline that parses against the contract", async () => {
    for (const order of dataset.orders) {
      const timeline = await tracker.timeline(order.header.no);
      orderTimelineSchema.parse(timeline);
      expect(timeline.steps.filter((s) => s.current)).toHaveLength(1);
      for (const check of timeline.checks) {
        checkResultSchema.parse(check);
        expect(check.ruleId.startsWith("mock.")).toBe(true);
      }
    }
  });

  it("says what a step changed, in our own words", async () => {
    const ready = dataset.orders.find(
      (o) => o.sampleScreenState === "sample-ready-to-pick",
    );
    if (!ready) throw new Error("No ready-to-pick sample");
    const timeline = await tracker.timeline(ready.header.no);
    expect(timeline.steps.map((s) => s.effect).join(" ")).toContain(
      "Payment confirmed: packing released",
    );
  });

  it("answers an unknown order with not found", async () => {
    await expect(tracker.timeline("SO-NOPE")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("matching on Navision numbers", () => {
  it("matches the customer by its number", async () => {
    const order = firstOrder();
    const { matches } = await tracker.timeline(order.header.no);
    const customer = matches.find((m) => m.kind === "customer");
    expect(customer?.matchedNo).toBe(order.header.sellToCustomerNo);
    expect(customer?.printedNo).toBe(order.header.sellToCustomerNo);
  });

  it("lists a look-alike name as a possible match and never the record itself", () => {
    const found = lookAlikes(
      "Harbour Marine Supply",
      [
        { no: "C0001", name: "Harbour Marine Supply" },
        { no: "C0002", name: "Harbour Marine Supplies Pte" },
        { no: "C0003", name: "Orchard Fittings" },
      ],
      "C0001",
      { threshold: 0.3 },
    );
    expect(found.map((m) => m.no)).toEqual(["C0002"]);
  });
});

describe("the exceptions queue over mock data", () => {
  it("lists contract-valid rows, newest first, a page at a time", () => {
    const page = exceptions.list({ page: 1, pageSize: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(2);
    exceptionSchema.parse(page.items[0]);
    const times = exceptions
      .list({ page: 1, pageSize: 50 })
      .items.map((e) => e.openedAt);
    expect(times).toEqual([...times].sort().reverse());
  });
});

describe("the status port", () => {
  it("answers from the sample states and knows nothing of unknown orders", async () => {
    const order = firstOrder();
    expect((await reader.statusOf(order.header.no))?.status.label).toBeTruthy();
    expect(await reader.statusOf("SO-NOPE")).toBeNull();
  });
});
