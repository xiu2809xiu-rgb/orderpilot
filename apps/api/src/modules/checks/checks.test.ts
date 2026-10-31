import {
  SAMPLE_SCREEN_STATES,
  createSyntheticDataset,
} from "@orderpilot/synthetic-data";
import {
  checkResultSchema,
  exceptionSchema,
  orderTimelineSchema,
  trackerOrderSchema,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { SAMPLE_STEPS } from "./domain/mock-status.js";
import { NotFoundError } from "../../common/domain-error.js";
import { ExceptionsService } from "./exceptions.service.js";
import { MockChecksRepository } from "./mock-checks.repository.js";
import { MockOrderStatusReader } from "./mock-order-status-reader.js";
import { TrackerService } from "./tracker.service.js";

const dataset = createSyntheticDataset();
const repo = new MockChecksRepository(() => dataset);
const reader = new MockOrderStatusReader(() => dataset);
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

describe("the tracker over the bigger set", () => {
  it("lists the newest orders first and pages through all 120", async () => {
    const first = await tracker.list({ page: 1, pageSize: 50 });
    const dates = first.items.map((o) => o.orderDate);
    expect(dates).toEqual([...dates].sort().reverse());
    const seen = new Set<string>();
    for (let page = 1; page <= 3; page++) {
      const rows = await tracker.list({ page, pageSize: 50 });
      for (const row of rows.items) seen.add(row.orderNo);
    }
    expect(seen.size).toBe(120);
    expect(first.total).toBe(120);
  });

  it("filters by status and by owner, and a count equals the list it opens", async () => {
    for (const state of SAMPLE_SCREEN_STATES) {
      const expected = dataset.orders.filter(
        (o) => o.sampleScreenState === state,
      ).length;
      const page = await tracker.list({ page: 1, pageSize: 5, status: state });
      expect(page.total, state).toBe(expected);
      expect(page.items.every((o) => o.status.code === state)).toBe(true);
    }
    const warehouse = await tracker.list({
      page: 1,
      pageSize: 200,
      ownerRole: "WAREHOUSE",
    });
    expect(warehouse.total).toBeGreaterThan(0);
    expect(warehouse.items.every((o) => o.ownerRole === "WAREHOUSE")).toBe(
      true,
    );
  });

  it("flags late orders from the dataset's own due dates, and counts open exceptions per order", async () => {
    const late = await tracker.list({
      page: 1,
      pageSize: 200,
      overdue: "true",
    });
    const expected = dataset.orders.filter(
      (o) => o.step.dueOn !== null && o.step.dueOn < dataset.asOf,
    ).length;
    expect(late.total).toBe(expected);
    const withExceptions = (
      await tracker.list({ page: 1, pageSize: 200 })
    ).items
      .filter((o) => o.openExceptions > 0)
      .reduce((sum, o) => sum + o.openExceptions, 0);
    expect(withExceptions).toBe(
      dataset.exceptions.filter((e) => e.state === "OPEN").length,
    );
  });

  it("keeps the sample steps in the order of the sample states", () => {
    expect(SAMPLE_STEPS.map((entry) => entry.state)).toEqual([
      ...SAMPLE_SCREEN_STATES,
    ]);
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

describe("the exceptions queue over the bigger set", () => {
  it("lists the open ones by default and the resolved ones on request", () => {
    const open = exceptions.list({ page: 1, pageSize: 200 });
    expect(open.total).toBe(
      dataset.exceptions.filter((e) => e.state === "OPEN").length,
    );
    expect(open.items.every((e) => e.state === "OPEN")).toBe(true);
    const resolved = exceptions.list({
      page: 1,
      pageSize: 200,
      state: "RESOLVED",
    });
    expect(resolved.total).toBeGreaterThan(0);
    expect(resolved.items.every((e) => e.state === "RESOLVED")).toBe(true);
  });

  it("shows the expected and found values of a packing-list mismatch", () => {
    const row = exceptions
      .list({ page: 1, pageSize: 200 })
      .items.find((e) => e.ruleId === "mock.sample-quantity");
    expect(row?.expected).not.toBe(row?.actual);
    expect(row?.id).toMatch(/^EXC-\d{8}-\d{4}$/);
  });
});

describe("the exceptions search", () => {
  it("narrows the queue to rows that mention the text", () => {
    const all = exceptions.list({ page: 1, pageSize: 50 });
    const first = all.items[0];
    if (!first) throw new Error("No sample exceptions");
    const found = exceptions.list({
      page: 1,
      pageSize: 50,
      search: first.orderNo,
    });
    expect(found.items.map((e) => e.orderNo)).toContain(first.orderNo);
    expect(found.total).toBeLessThan(all.total);
    expect(
      exceptions.list({ page: 1, pageSize: 50, search: "zzz" }).total,
    ).toBe(0);
  });
});

describe("the status port", () => {
  it("answers from the sample states and knows nothing of unknown orders", async () => {
    const order = firstOrder();
    expect((await reader.statusOf(order.header.no))?.status.label).toBeTruthy();
    expect(await reader.statusOf("SO-NOPE")).toBeNull();
  });
});
