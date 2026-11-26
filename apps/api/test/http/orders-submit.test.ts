import {
  HEADERS,
  ROLES,
  existingOrderOf,
  customerResponseSchema,
  itemResponseSchema,
  salesOrderListSchema,
  salesOrderResponseSchema,
  type ErrorCode,
  type Role,
  type SalesOrderDetail,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ConflictError, DomainError } from "../../src/common/domain-error.js";
import {
  OrderHandoff,
  type HandoffAnswer,
  type OrderSubmitted,
} from "../../src/modules/orders/domain/order-handoff.js";
import { SalesOrder } from "../../src/modules/orders/domain/sales-order.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
import { WorkflowOrderStatusReader } from "../../src/modules/workflows/workflow-order-status-reader.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const O = `${API}/orders`;
const M = `${API}/master-data`;

/** The port, counting its calls and answering as each test says. */
const handoff = {
  calls: [] as OrderSubmitted[],
  next: null as null | (() => Promise<HandoffAnswer>),
  submitted(fact: OrderSubmitted): Promise<HandoffAnswer> {
    this.calls.push(fact);
    return this.next ? this.next() : Promise.resolve({ effect: "none" });
  },
  poVersionConfirmed(): Promise<HandoffAnswer> {
    return Promise.resolve({ effect: "none" });
  },
};

/** Area 2's reader, holding the labels a test gives it. */
const labels = new Map<string, string>();
const reader = {
  statusOf: () => Promise.resolve(null),
  statusOfMany: (nos: readonly string[]) =>
    Promise.resolve(
      new Map(
        nos.flatMap((no) => {
          const label = labels.get(no);
          return label === undefined
            ? []
            : [[no, { status: { code: "Received", label } }] as const];
        }),
      ),
    ),
};

describe("submitting draft orders over HTTP", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  const dataset = syntheticDataset();
  const [customer] = dataset.customers;
  const [item] = dataset.items;
  if (!customer || !item) throw new Error("the set is empty");

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [], (builder) =>
      builder
        .overrideProvider(OrderHandoff)
        .useValue(handoff)
        .overrideProvider(WorkflowOrderStatusReader)
        .useValue(reader),
    );
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });
  beforeEach(() => {
    handoff.calls.length = 0;
    handoff.next = null;
    labels.clear();
  });

  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`no session for ${role}`);
    return browser;
  };
  const send = (
    role: Role,
    path: string,
    body: object,
    csrf: boolean | string = true,
  ) => call(t, as(role), "post", path, { csrf, body });
  const read = (role: Role, path: string) => call(t, as(role), "get", path);

  let sequence = 0;
  const newPo = () => `PO-S-${String((sequence += 1))}`;
  const detail = (res: { body: unknown }): SalesOrderDetail =>
    salesOrderResponseSchema.parse(res.body).data;
  const errorOf = (res: { body: unknown }) =>
    (
      res.body as {
        error: { code: string; message: string; details: unknown };
      }
    ).error;
  const create = async (
    role: Role = "SUPPORT",
    over: Record<string, unknown> = {},
  ) => {
    const res = await send(role, O, {
      customerNo: customer.no,
      externalDocumentNo: newPo(),
      orderDate: "2026-11-10",
      shipmentDate: null,
      prepaymentPercent: "30",
      lines: [{ itemNo: item.no, quantity: "5", unitPrice: "12.50" }],
      ...over,
    });
    expect(res.status, res.text).toBe(201);
    return detail(res);
  };
  const submit = (role: Role, orderNo: string, version = 1) =>
    send(role, `${O}/${orderNo}/submit`, { version });
  const stateOf = async (orderNo: string) =>
    detail(await read("SUPPORT", `${O}/${orderNo}`));
  const eventsOf = async (action: string, orderNo: string) =>
    (await auditEvents(t)).filter(
      (e) => e.action === action && e.entityId === orderNo,
    );
  const refusals = async () =>
    (await auditEvents(t)).filter((e) => e.action === "auth.permission.refused")
      .length;
  const storedCount = () =>
    t.app.get(SalesOrderRepository, { strict: false }).countAll();

  describe("who may, and what is checked first", () => {
    it("answers 401 with no session", async () => {
      const res = await call(t, null, "post", `${O}/SO-20261110-0001/submit`, {
        body: { version: 1 },
      });
      expect(res.status).toBe(401);
    });

    it("answers 403 to every role but Support and the Product Manager, audits each as a permission refusal only, and submits nothing", async () => {
      const mine = await create();
      const refused = ROLES.filter(
        (role) => role !== "SUPPORT" && role !== "PRODUCT_MANAGER",
      );
      expect(refused.length).toBeGreaterThan(0);
      for (const role of refused) {
        const marked = await refusals();
        const res = await submit(role, mine.orderNo);
        expect(res.status, `${role} ${res.text}`).toBe(403);
        expect(await refusals()).toBe(marked + 1);
      }
      // A permission refusal is the guard's, not the next team's.
      expect(await eventsOf("order.submit.refused", mine.orderNo)).toHaveLength(
        0,
      );
      expect(handoff.calls).toHaveLength(0);
      expect(await stateOf(mine.orderNo)).toMatchObject({
        captureState: "draft",
        version: 1,
      });
      expect(await eventsOf("order.submitted", mine.orderNo)).toHaveLength(0);
    });

    it("answers CSRF_INVALID without the header, and submits nothing", async () => {
      const mine = await create();
      const res = await send(
        "SUPPORT",
        `${O}/${mine.orderNo}/submit`,
        { version: 1 },
        false,
      );
      expect(res.status, res.text).toBe(403);
      expect(errorOf(res).code).toBe("CSRF_INVALID");
      expect(handoff.calls).toHaveLength(0);
      expect((await stateOf(mine.orderNo)).captureState).toBe("draft");
    });

    it("answers 404 for an unknown number and for a sample order", async () => {
      for (const no of ["SO-20990101-0001", "SO-0001"]) {
        const res = await submit("SUPPORT", no);
        expect(res.status, no).toBe(404);
        expect(errorOf(res).code).toBe("NOT_FOUND");
      }
      expect(handoff.calls).toHaveLength(0);
    });

    it("answers 400 for a missing, zero or fractional version and for a malformed number", async () => {
      const mine = await create();
      for (const body of [{}, { version: 0 }, { version: 1.5 }]) {
        const res = await send("SUPPORT", `${O}/${mine.orderNo}/submit`, body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(JSON.stringify(errorOf(res).details)).toContain("version");
      }
      const bad = await submit("SUPPORT", "not%20a%20number");
      expect(bad.status).toBe(400);
      expect(handoff.calls).toHaveLength(0);
      expect((await stateOf(mine.orderNo)).captureState).toBe("draft");
    });

    it("answers 400 on the right path for a draft whose customer and item master data does not know, and leaves it a draft", async () => {
      const repository = t.app.get(SalesOrderRepository, { strict: false });
      const mine = await create();
      const known = await repository.findByNo(mine.orderNo);
      if (!known) throw new Error("the draft was not stored");
      const seeded = (orderNo: string, customerNo: string, itemNo: string) =>
        repository.insert(
          new SalesOrder({
            orderNo,
            navisionNo: null,
            captureState: "draft",
            customerNo,
            externalDocumentNo: newPo(),
            orderDate: "2026-11-10",
            shipmentDate: null,
            currencyCode: "USD",
            prepaymentPercent: "0",
            createdBy: known.createdBy,
            version: 1,
            lines: [
              {
                lineNo: 1,
                itemNo,
                description: "Synthetic line",
                quantity: "1",
                unitPrice: "1.00",
                qtyToShip: "1",
              },
            ],
          }),
        );
      await seeded("SO-20261126-9001", "C-NOSUCH", item.no);
      await seeded("SO-20261126-9002", customer.no, "I-NOSUCH");
      const noCustomer = await submit("SUPPORT", "SO-20261126-9001");
      expect(noCustomer.status).toBe(400);
      expect(errorOf(noCustomer).details).toEqual([
        {
          path: "customerNo",
          message: "No customer has this Business Central number.",
        },
      ]);
      const noItem = await submit("SUPPORT", "SO-20261126-9002");
      expect(noItem.status).toBe(400);
      expect(errorOf(noItem).details).toEqual([
        {
          path: "lines.0.itemNo",
          message: "No item has this Business Central number.",
        },
      ]);
      expect(handoff.calls).toHaveLength(0);
      for (const orderNo of ["SO-20261126-9001", "SO-20261126-9002"])
        expect(await stateOf(orderNo)).toMatchObject({
          captureState: "draft",
          version: 1,
        });
    });
  });

  describe("a submit", () => {
    it("submits a draft for Support and for a Product Manager: submitted, version up by one, read back masked for the writer's role, workflowStatus null", async () => {
      for (const role of ["SUPPORT", "PRODUCT_MANAGER"] as const) {
        const mine = await create(role);
        const res = await submit(role, mine.orderNo);
        expect(res.status, res.text).toBe(200);
        const done = detail(res);
        expect(done).toMatchObject({
          orderNo: mine.orderNo,
          captureState: "submitted",
          version: 2,
          workflowStatus: null,
        });
        expect(done.amount.masked).toBe(false);
        expect(await stateOf(mine.orderNo)).toMatchObject({
          captureState: "submitted",
          version: 2,
        });
        const [row] = await eventsOf("order.submitted", mine.orderNo);
        expect(row?.actor).toMatchObject({ role });
      }
    });

    it("calls the handoff once, with the stored total, the person's id, name and role, and the request's trace id", async () => {
      const mine = await create("SUPPORT");
      const res = await call(
        t,
        as("SUPPORT"),
        "post",
        `${O}/${mine.orderNo}/submit`,
        { csrf: true, body: { version: 1 } },
      ).set(HEADERS.requestId, "t-submit-http-1");
      expect(res.status, res.text).toBe(200);
      expect(handoff.calls).toHaveLength(1);
      const [fact] = handoff.calls;
      expect(fact).toMatchObject({
        orderNo: mine.orderNo,
        customerNo: customer.no,
        submittedBy: { name: expect.any(String) as string, role: "SUPPORT" },
        total: "62.50",
        prepaymentPercent: "30.00",
        poVersionNo: 1,
        request: { traceId: "t-submit-http-1" },
      });
      expect(fact?.submittedBy.userId).toMatch(/^[0-9a-f-]{36}$/);
      const [row] = await eventsOf("order.submitted", mine.orderNo);
      expect(row?.traceId).toBe("t-submit-http-1");
      expect(row?.changes).toMatchObject({
        lines: 1,
        version: { from: 1, to: 2 },
        poVersionNo: 1,
        workflowEffect: "none",
      });
    });

    it("answers 409 for a stale version and leaves the draft a draft", async () => {
      const mine = await create();
      const res = await submit("SUPPORT", mine.orderNo, 7);
      expect(res.status).toBe(409);
      expect(errorOf(res).message).toContain("changed by someone else");
      expect(handoff.calls).toHaveLength(0);
      expect(await stateOf(mine.orderNo)).toMatchObject({
        captureState: "draft",
        version: 1,
      });
    });

    it("answers 409 'already submitted' for a second submit, and the version moves once", async () => {
      const mine = await create();
      expect((await submit("SUPPORT", mine.orderNo)).status).toBe(200);
      const again = await submit("SUPPORT", mine.orderNo, 2);
      expect(again.status).toBe(409);
      expect(errorOf(again).message).toBe(
        `Order ${mine.orderNo} is already submitted.`,
      );
      expect(handoff.calls).toHaveLength(1);
      expect((await stateOf(mine.orderNo)).version).toBe(2);
      expect(await eventsOf("order.submitted", mine.orderNo)).toHaveLength(1);
    });

    it("answers 409 for a void order with the draft rule's words", async () => {
      const mine = await create();
      const voided = await send("SUPPORT", `${O}/${mine.orderNo}/void`, {
        version: 1,
        reason: "Entered twice.",
      });
      expect(voided.status, voided.text).toBe(200);
      const res = await submit("SUPPORT", mine.orderNo, 2);
      expect(res.status).toBe(409);
      expect(errorOf(res).message).toBe(
        `Order ${mine.orderNo} is void, so it cannot be submitted. Only a draft can.`,
      );
      expect(handoff.calls).toHaveLength(0);
    });

    it("gives [200, 409] for two submits at once, with one order.submitted row and one handoff call", async () => {
      const mine = await create();
      // A slow handoff holds the first transaction open while the second
      // request reads the order, which is still a draft, so they truly race.
      handoff.next = () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ effect: "none" });
          }, 300);
        });
      const both = await Promise.all([
        submit("SUPPORT", mine.orderNo),
        submit("PRODUCT_MANAGER", mine.orderNo),
      ]);
      expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
      const lost = both.filter((r) => r.status === 409).map(errorOf);
      expect(lost.map((e) => e.message)).toEqual([
        `Order ${mine.orderNo} is already submitted.`,
      ]);
      expect(handoff.calls).toHaveLength(1);
      expect(await eventsOf("order.submitted", mine.orderNo)).toHaveLength(1);
      expect((await stateOf(mine.orderNo)).version).toBe(2);
    });
  });

  describe("when the workflow refuses", () => {
    it("leaves a draft, with its version and no order.submitted row, when the workflow refuses, shows its words as the answer and writes one order.submit.refused row", async () => {
      const mine = await create();
      handoff.next = () =>
        Promise.reject(new ConflictError("Synthetic refusal words."));
      const res = await submit("SUPPORT", mine.orderNo);
      expect(res.status).toBe(409);
      expect(errorOf(res)).toMatchObject({
        code: "CONFLICT",
        message: "Synthetic refusal words.",
      });
      expect(handoff.calls).toHaveLength(1);
      expect(await stateOf(mine.orderNo)).toMatchObject({
        captureState: "draft",
        version: 1,
      });
      expect(await eventsOf("order.submitted", mine.orderNo)).toHaveLength(0);
      const rows = await eventsOf("order.submit.refused", mine.orderNo);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.changes).toEqual({
        refusedBy: "workflow",
        code: "CONFLICT",
        version: 1,
      });
      expect(rows[0]?.summary).toMatch(/was refused by the order flow$/);
      expect(rows[0]?.summary).not.toMatch(/workflow/i);
      expect(JSON.stringify(rows[0])).not.toContain("Synthetic refusal words");
      // Nothing was left half done: the order can be submitted once it is fine.
      handoff.next = null;
      expect((await submit("SUPPORT", mine.orderNo)).status).toBe(200);
    });

    it("answers a refusal with its own status and code, and audits only the code", async () => {
      const codes: [ErrorCode, number][] = [
        ["VALIDATION_FAILED", 400],
        ["FORBIDDEN", 403],
        ["CONFLICT", 409],
      ];
      for (const [code, status] of codes) {
        const mine = await create();
        handoff.next = () =>
          Promise.reject(new DomainError(code, `Words for ${code}.`));
        const res = await submit("SUPPORT", mine.orderNo);
        expect(res.status, code).toBe(status);
        expect(errorOf(res)).toMatchObject({
          code,
          message: `Words for ${code}.`,
        });
        const rows = await eventsOf("order.submit.refused", mine.orderNo);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.changes).toMatchObject({ code });
      }
    });

    it("leaves a draft and writes no row when the handoff throws a plain error", async () => {
      const mine = await create();
      handoff.next = () => Promise.reject(new Error("synthetic outage"));
      const res = await submit("SUPPORT", mine.orderNo);
      expect(res.status).toBe(500);
      expect(errorOf(res).code).toBe("INTERNAL_ERROR");
      expect(JSON.stringify(res.body)).not.toContain("synthetic outage");
      expect(await stateOf(mine.orderNo)).toMatchObject({
        captureState: "draft",
        version: 1,
      });
      expect(await eventsOf("order.submitted", mine.orderNo)).toHaveLength(0);
      expect(await eventsOf("order.submit.refused", mine.orderNo)).toHaveLength(
        0,
      );
    });
  });

  describe("what a submit leaves in the trail and elsewhere", () => {
    it("keeps every price out of the order.submitted and order.submit.refused events", async () => {
      // Odd prices, so that a chance match cannot pass: a unit price of 31.97
      // and a quantity of 229 make a total of 7321.13.
      const mine = await create("SUPPORT", {
        lines: [{ itemNo: item.no, quantity: "229", unitPrice: "31.97" }],
      });
      expect(mine.amount.value).toBe("7321.13");
      const refused = await create("SUPPORT", {
        lines: [{ itemNo: item.no, quantity: "229", unitPrice: "31.97" }],
      });
      handoff.next = () => Promise.reject(new ConflictError("Not now."));
      expect((await submit("SUPPORT", refused.orderNo)).status).toBe(409);
      handoff.next = null;
      expect((await submit("SUPPORT", mine.orderNo)).status).toBe(200);
      const events = [
        ...(await eventsOf("order.submitted", mine.orderNo)),
        ...(await eventsOf("order.submit.refused", refused.orderNo)),
      ];
      expect(events).toHaveLength(2);
      for (const event of events) {
        const keys = Object.keys(event.changes ?? {});
        for (const forbidden of ["total", "unitPrice", "amount"])
          expect(keys).not.toContain(forbidden);
        // The line count is a number, never the lines.
        if ("lines" in (event.changes ?? {}))
          expect(typeof event.changes?.lines).toBe("number");
        // The words and the changes only: the stored event also holds a random
        // id and two 64-character hashes, where "7321" can turn up by chance.
        const text = `${event.summary} ${JSON.stringify(event.changes)}`;
        for (const price of ["31.97", "7321.13", "7321"])
          expect(text).not.toContain(price);
      }
    });

    it("a submitted order still holds its PO number: the same PO again is the 409 that names it", async () => {
      const po = newPo();
      const mine = await create("SUPPORT", { externalDocumentNo: po });
      expect((await submit("SUPPORT", mine.orderNo)).status).toBe(200);
      const res = await send("SUPPORT", O, {
        customerNo: customer.no,
        externalDocumentNo: po,
        orderDate: "2026-11-10",
        shipmentDate: null,
        prepaymentPercent: "30",
        lines: [{ itemNo: item.no, quantity: "5", unitPrice: "12.50" }],
      });
      expect(res.status).toBe(409);
      expect(existingOrderOf(errorOf(res).details as never)).toBe(mine.orderNo);
    });

    it("a submitted order counts as an open order on its customer's page and leaves the item's available stock alone", async () => {
      const mine = await create();
      const figures = async () =>
        itemResponseSchema.parse(
          (await read("SUPPORT", `${M}/items/${item.no}`)).body,
        ).data;
      const customerPage = async () =>
        customerResponseSchema.parse(
          (await read("SUPPORT", `${M}/customers/${customer.no}`)).body,
        ).data;
      const before = await figures();
      const open = (await customerPage()).openOrders.map((o) => o.orderNo);
      expect(open).not.toContain(mine.orderNo);
      expect((await submit("SUPPORT", mine.orderNo)).status).toBe(200);
      const after = await figures();
      expect((await customerPage()).openOrders.map((o) => o.orderNo)).toContain(
        mine.orderNo,
      );
      expect(after.orderLines.map((l) => l.orderNo)).toContain(mine.orderNo);
      expect(after.availableStock).toBe(before.availableStock);
    });

    it("a submit changes no row count in the list", async () => {
      const mine = await create();
      const total = async () =>
        salesOrderListSchema.parse(
          (await read("SUPPORT", `${O}?pageSize=5`)).body,
        ).meta.total;
      const before = await total();
      const stored = await storedCount();
      expect((await submit("SUPPORT", mine.orderNo)).status).toBe(200);
      expect(await total()).toBe(before);
      expect(await storedCount()).toBe(stored);
    });

    it("gives the list and the detail the workflow's label when the reader has one for the order", async () => {
      const held = await create();
      const free = await create();
      expect((await submit("SUPPORT", held.orderNo)).status).toBe(200);
      expect((await submit("SUPPORT", free.orderNo)).status).toBe(200);
      labels.set(held.orderNo, "PO received");
      const list = salesOrderListSchema.parse(
        (await read("SUPPORT", `${O}?pageSize=100&source=stored`)).body,
      );
      const byNo = new Map(list.data.map((row) => [row.orderNo, row]));
      expect(byNo.get(held.orderNo)?.workflowStatus).toBe("PO received");
      expect(byNo.get(free.orderNo)?.workflowStatus).toBeNull();
      expect((await stateOf(held.orderNo)).workflowStatus).toBe("PO received");
      expect((await stateOf(free.orderNo)).workflowStatus).toBeNull();
    });
  });
});
