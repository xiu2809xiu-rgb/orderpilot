import {
  HEADERS,
  ROLES,
  existingOrderOf,
  customerResponseSchema,
  itemResponseSchema,
  poVersionConfirmedResponseSchema,
  poVersionDetailResponseSchema,
  poVersionDifferencesResponseSchema,
  poVersionListResponseSchema,
  salesOrderListSchema,
  salesOrderResponseSchema,
  type ErrorCode,
  type Role,
  type SalesOrderDetail,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RolePermissionRepository } from "../../src/auth/role-permission.repository.js";
import { ConflictError, DomainError } from "../../src/common/domain-error.js";
import {
  OrderHandoff,
  type HandoffAnswer,
  type PoVersionConfirmed,
} from "../../src/modules/orders/domain/order-handoff.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
import { WorkflowOrderStatusReader } from "../../src/modules/workflows/workflow-order-status-reader.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData, testConfig } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const O = `${API}/orders`;
const M = `${API}/master-data`;

/** The port, counting its calls and answering as each test says. */
const handoff = {
  confirmed: [] as PoVersionConfirmed[],
  next: null as null | ((fact: PoVersionConfirmed) => Promise<HandoffAnswer>),
  submitted(): Promise<HandoffAnswer> {
    return Promise.resolve({ effect: "none" });
  },
  poVersionConfirmed(fact: PoVersionConfirmed): Promise<HandoffAnswer> {
    this.confirmed.push(fact);
    return this.next ? this.next(fact) : Promise.resolve({ effect: "none" });
  },
};
const reader = {
  statusOf: () => Promise.resolve(null),
  statusOfMany: () => Promise.resolve(new Map()),
};

// The last is the masked writer's revised total: 230 at 31.97.
const PRICES_SEEN = ["31.97", "33.41", "7321.13", "7650.89", "7353.10"];
const MASKED_KEYS = ["classification", "field", "masked", "reason"];

describe("PO versions over HTTP", () => {
  let t: TestApp;
  let db: pg.Client;
  const sessions = new Map<Role, Browser>();
  const dataset = syntheticDataset();
  const [customer, other] = dataset.customers;
  const [item, second] = dataset.items;
  if (!customer || !other || !item || !second)
    throw new Error("the set is empty");

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
    db = new pg.Client({ connectionString: testConfig().database.url });
    await db.connect();
  });
  afterAll(async () => {
    await db.end();
    await t.close();
  });
  beforeEach(() => {
    handoff.confirmed.length = 0;
    handoff.next = null;
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
  const newPo = () => `PO-R-${String((sequence += 1))}`;
  const detail = (res: { body: unknown }): SalesOrderDetail =>
    salesOrderResponseSchema.parse(res.body).data;
  const errorOf = (res: { body: unknown }) =>
    (
      res.body as {
        error: { code: string; message: string; details: unknown };
      }
    ).error;

  const line = (quantity: string, unitPrice = "12.50", itemNo = item.no) => ({
    itemNo,
    quantity,
    unitPrice,
  });
  /** The body of a new order, or of a revision of it: the dates and lines of `over` replace these. */
  const bodyOf = (po: string, over: Record<string, unknown> = {}) => ({
    customerNo: customer.no,
    externalDocumentNo: po,
    orderDate: "2026-11-10",
    shipmentDate: null,
    prepaymentPercent: "30",
    lines: [line("5")],
    ...over,
  });
  const create = async (over: Record<string, unknown> = {}) => {
    const res = await send("SUPPORT", O, bodyOf(newPo(), over));
    expect(res.status, res.text).toBe(201);
    return detail(res);
  };
  /** A stored order that has been submitted, so it can be revised. */
  const submitted = async (over: Record<string, unknown> = {}) => {
    const made = await create(over);
    const res = await send("SUPPORT", `${O}/${made.orderNo}/submit`, {
      version: 1,
    });
    expect(res.status, res.text).toBe(200);
    return detail(res);
  };
  const P = (orderNo: string) => `${O}/${orderNo}/po-versions`;
  const preview = (
    role: Role,
    order: SalesOrderDetail,
    over: Record<string, unknown> = {},
  ) =>
    send(
      role,
      `${P(order.orderNo)}/preview`,
      bodyOf(order.externalDocumentNo, over),
    );
  const confirm = (
    role: Role,
    order: SalesOrderDetail,
    over: Record<string, unknown> = {},
    expected = 1,
    csrf: boolean | string = true,
  ) =>
    send(
      role,
      P(order.orderNo),
      {
        ...bodyOf(order.externalDocumentNo, over),
        confirmed: true,
        expectedPoVersionNo: expected,
      },
      csrf,
    );
  const stateOf = async (orderNo: string) =>
    detail(await read("SUPPORT", `${O}/${orderNo}`));
  const versionsOf = async (orderNo: string, role: Role = "SUPPORT") => {
    const res = await read(role, P(orderNo));
    expect(res.status, res.text).toBe(200);
    return poVersionListResponseSchema.parse(res.body).data;
  };
  const eventsOf = async (action: string, orderNo: string) =>
    (await auditEvents(t)).filter(
      (e) => e.action === action && e.entityId === orderNo,
    );
  const refusals = async () =>
    (await auditEvents(t)).filter((e) => e.action === "auth.permission.refused")
      .length;
  const copiesOf = async (orderNo: string): Promise<number> => {
    const { rows } = await db.query<{ n: string }>(
      `SELECT count(*) AS n FROM "SalesOrderPoVersion" v
         JOIN "SalesOrder" o ON o."id" = v."orderId" WHERE o."orderNo" = $1`,
      [orderNo],
    );
    return Number(rows[0]?.n);
  };

  describe("who may, and what is checked first", () => {
    it("answers 401 with no session on every route", async () => {
      const no = "SO-20261110-0001";
      for (const res of [
        await call(t, null, "get", P(no)),
        await call(t, null, "get", `${P(no)}/diff?from=1&to=2`),
        await call(t, null, "get", `${P(no)}/1`),
        await call(t, null, "post", `${P(no)}/preview`, {
          body: bodyOf("PO-1"),
        }),
        await call(t, null, "post", P(no), {
          body: { ...bodyOf("PO-1"), confirmed: true, expectedPoVersionNo: 1 },
        }),
      ])
        expect(res.status).toBe(401);
    });

    it("answers 403 to Warehouse, Auditor and System admin on both writes, audits each refusal and writes nothing", async () => {
      const mine = await submitted();
      const refused = ROLES.filter(
        (role) => role !== "SUPPORT" && role !== "PRODUCT_MANAGER",
      );
      expect(refused).toEqual(
        expect.arrayContaining(["WAREHOUSE", "AUDITOR", "SYSTEM_ADMIN"]),
      );
      for (const role of refused) {
        const marked = await refusals();
        const asked = await preview(role, mine, { lines: [line("8")] });
        expect(asked.status, `${role} ${asked.text}`).toBe(403);
        const done = await confirm(role, mine, { lines: [line("8")] });
        expect(done.status, `${role} ${done.text}`).toBe(403);
        expect(await refusals()).toBe(marked + 2);
      }
      expect(handoff.confirmed).toHaveLength(0);
      expect(await copiesOf(mine.orderNo)).toBe(0);
      expect(
        await eventsOf("order.po_version_confirmed", mine.orderNo),
      ).toHaveLength(0);
      expect(await stateOf(mine.orderNo)).toMatchObject({
        version: 2,
        poVersionNo: 1,
      });
    });

    it("answers 403 to System admin on the three reads, audited", async () => {
      const mine = await submitted();
      for (const path of [
        P(mine.orderNo),
        `${P(mine.orderNo)}/1`,
        `${P(mine.orderNo)}/diff?from=1&to=2`,
      ]) {
        const marked = await refusals();
        const res = await read("SYSTEM_ADMIN", path);
        expect(res.status, path).toBe(403);
        expect(await refusals()).toBe(marked + 1);
      }
    });

    it("answers CSRF_INVALID on both writes without the header, and stores nothing", async () => {
      const mine = await submitted();
      const body = bodyOf(mine.externalDocumentNo, { lines: [line("8")] });
      const asked = await send(
        "SUPPORT",
        `${P(mine.orderNo)}/preview`,
        body,
        false,
      );
      expect(asked.status, asked.text).toBe(403);
      expect(errorOf(asked).code).toBe("CSRF_INVALID");
      const done = await confirm(
        "SUPPORT",
        mine,
        { lines: [line("8")] },
        1,
        false,
      );
      expect(done.status, done.text).toBe(403);
      expect(errorOf(done).code).toBe("CSRF_INVALID");
      expect(handoff.confirmed).toHaveLength(0);
      expect(await copiesOf(mine.orderNo)).toBe(0);
    });

    it("answers 404 for an unknown number and for a sample order on every route", async () => {
      for (const no of ["SO-20990101-0001", "SO-0001"]) {
        const reads = [P(no), `${P(no)}/diff?from=1&to=2`, `${P(no)}/1`];
        for (const path of reads) {
          const res = await read("SUPPORT", path);
          expect(res.status, path).toBe(404);
          expect(errorOf(res)).toMatchObject({
            code: "NOT_FOUND",
            message: "Order was not found.",
          });
        }
        const asked = await send("SUPPORT", `${P(no)}/preview`, bodyOf("PO-1"));
        expect(asked.status, no).toBe(404);
        const done = await send("SUPPORT", P(no), {
          ...bodyOf("PO-1"),
          confirmed: true,
          expectedPoVersionNo: 1,
        });
        expect(done.status, no).toBe(404);
      }
      expect(handoff.confirmed).toHaveLength(0);
    });

    it("answers 404 for an unknown PO version and 400 for a malformed, zero or fractional PO version number", async () => {
      const mine = await submitted();
      const unknown = await read("SUPPORT", `${P(mine.orderNo)}/9`);
      expect(unknown.status).toBe(404);
      expect(errorOf(unknown).message).toBe("PO version was not found.");
      for (const bad of ["abc", "0", "1.5", "2147483648"]) {
        const res = await read("SUPPORT", `${P(mine.orderNo)}/${bad}`);
        expect(res.status, bad).toBe(400);
        expect(errorOf(res).code).toBe("VALIDATION_FAILED");
      }
      const beyond = await read(
        "SUPPORT",
        `${P(mine.orderNo)}/diff?from=1&to=4`,
      );
      expect(beyond.status).toBe(404);
      for (const query of ["", "?from=1", "?from=a&to=2", "?from=0&to=2"]) {
        const res = await read("SUPPORT", `${P(mine.orderNo)}/diff${query}`);
        expect(res.status, query).toBe(400);
      }
    });

    it("answers 400 for a body with no confirmed, with confirmed false, with no expectedPoVersionNo or a fractional one, and for bad lines", async () => {
      const mine = await submitted();
      const full = {
        ...bodyOf(mine.externalDocumentNo, { lines: [line("8")] }),
        confirmed: true,
        expectedPoVersionNo: 1,
      };
      // An undefined key is left out of the JSON that is sent.
      const noConfirmed = { ...full, confirmed: undefined };
      const noExpected = { ...full, expectedPoVersionNo: undefined };
      const bodies = [
        noConfirmed,
        { ...full, confirmed: false },
        noExpected,
        { ...full, expectedPoVersionNo: 1.5 },
        { ...full, expectedPoVersionNo: 0 },
        { ...full, lines: [] },
        { ...full, lines: [line("abc")] },
      ];
      for (const body of bodies) {
        const res = await send("SUPPORT", P(mine.orderNo), body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(errorOf(res).code).toBe("VALIDATION_FAILED");
      }
      expect(handoff.confirmed).toHaveLength(0);
      expect(await copiesOf(mine.orderNo)).toBe(0);
    });
  });

  describe("what may be revised", () => {
    it("answers 409 for a draft, with the words that say to edit it, and for a void order, on both preview and confirm", async () => {
      const draft = await create();
      const closed = await create();
      const voided = await send("SUPPORT", `${O}/${closed.orderNo}/void`, {
        version: 1,
        reason: "Entered twice.",
      });
      expect(voided.status, voided.text).toBe(200);
      const cases = [
        [
          draft,
          "draft",
          `Order ${draft.orderNo} is a draft, so edit it. Only a submitted order is revised.`,
        ],
        [
          closed,
          "void",
          `Order ${closed.orderNo} is void, so it cannot be revised. Only a submitted order can be.`,
        ],
      ] as const;
      for (const [order, state, words] of cases) {
        for (const res of [
          await preview("SUPPORT", order, { lines: [line("8")] }),
          await confirm("SUPPORT", order, { lines: [line("8")] }, 99),
        ]) {
          expect(res.status, state).toBe(409);
          expect(errorOf(res)).toMatchObject({
            code: "CONFLICT",
            message: words,
            details: [{ path: "captureState", message: state }],
          });
        }
        expect(await copiesOf(order.orderNo)).toBe(0);
      }
      expect(handoff.confirmed).toHaveLength(0);
      expect(await stateOf(draft.orderNo)).toMatchObject({
        captureState: "draft",
        version: 1,
      });
    });

    it("answers 409 on the three reads for a draft and a void order, and a draft edited twice never lists a version", async () => {
      const draft = await create();
      for (const version of [1, 2]) {
        const res = await call(
          t,
          as("SUPPORT"),
          "patch",
          `${O}/${draft.orderNo}`,
          {
            csrf: true,
            body: { version, prepaymentPercent: String(40 + version) },
          },
        );
        expect(res.status, res.text).toBe(200);
      }
      const closed = await create();
      expect(
        (
          await send("SUPPORT", `${O}/${closed.orderNo}/void`, {
            version: 1,
            reason: "Entered twice.",
          })
        ).status,
      ).toBe(200);
      for (const [order, state] of [
        [draft, "draft"],
        [closed, "void"],
      ] as const) {
        for (const path of [
          P(order.orderNo),
          `${P(order.orderNo)}/1`,
          `${P(order.orderNo)}/diff?from=1&to=2`,
        ]) {
          const res = await read("SUPPORT", path);
          expect(res.status, `${state} ${path}`).toBe(409);
          expect(errorOf(res).details).toEqual([
            { path: "captureState", message: state },
          ]);
        }
      }
      expect(await copiesOf(draft.orderNo)).toBe(0);
    });

    it("answers 400 for another customer on customerNo and for another PO number on externalDocumentNo, and accepts the same number in another case", async () => {
      const mine = await submitted();
      const customerRes = await preview("SUPPORT", mine, {
        customerNo: other.no,
        lines: [line("8")],
      });
      expect(customerRes.status).toBe(400);
      expect(errorOf(customerRes).details).toEqual([
        {
          path: "customerNo",
          message:
            "A revised PO is for the same customer. A PO for another customer is a new order.",
        },
      ]);
      const poRes = await send(
        "SUPPORT",
        `${P(mine.orderNo)}/preview`,
        bodyOf("PO-OTHER", { lines: [line("8")] }),
      );
      expect(poRes.status).toBe(400);
      expect(errorOf(poRes).details).toEqual([
        {
          path: "externalDocumentNo",
          message: `A revised PO keeps the PO number ${mine.externalDocumentNo}. A PO with another number is a new order.`,
        },
      ]);
      const cased = await send(
        "SUPPORT",
        `${P(mine.orderNo)}/preview`,
        bodyOf(` ${mine.externalDocumentNo.toLowerCase()} `, {
          lines: [line("8")],
        }),
      );
      expect(cased.status, cased.text).toBe(200);
      expect(await copiesOf(mine.orderNo)).toBe(0);
    });

    it("answers 400 for identical content on confirm and 200 with identical true on preview", async () => {
      const mine = await submitted();
      const asked = await preview("SUPPORT", mine);
      expect(asked.status, asked.text).toBe(200);
      expect(
        poVersionDifferencesResponseSchema.parse(asked.body).data,
      ).toMatchObject({
        identical: true,
        fromPoVersionNo: 1,
        toPoVersionNo: 2,
      });
      const done = await confirm("SUPPORT", mine);
      expect(done.status).toBe(400);
      expect(errorOf(done).details).toEqual([
        {
          path: "revision",
          message:
            "This PO has the same dates, quantities and prices as PO version 1, so there is nothing to confirm. Descriptions are not compared.",
        },
      ]);
      expect(handoff.confirmed).toHaveLength(0);
      expect(await copiesOf(mine.orderNo)).toBe(0);
    });

    it("answers 400 for a shipment date before the order date and for an unknown item", async () => {
      const mine = await submitted();
      const dates = await preview("SUPPORT", mine, {
        orderDate: "2026-11-20",
        shipmentDate: "2026-11-01",
      });
      expect(dates.status).toBe(400);
      expect(JSON.stringify(errorOf(dates).details)).toContain("shipmentDate");
      const unknown = await preview("SUPPORT", mine, {
        lines: [line("1", "1.00", "I-NOSUCH")],
      });
      expect(unknown.status).toBe(400);
      expect(errorOf(unknown).details).toEqual([
        {
          path: "lines.0.itemNo",
          message: "No item has this Business Central number.",
        },
      ]);
    });
  });

  describe("a revision", () => {
    it("confirms a revised PO as PO version 2: 201, the lines replaced, PO version 1 kept and marked superseded, the edit token up by one, the customer and PO number unchanged", async () => {
      const mine = await submitted();
      const res = await confirm("SUPPORT", mine, {
        orderDate: "2026-11-20",
        lines: [line("8"), line("2", "7.25", second.no)],
      });
      expect(res.status, res.text).toBe(201);
      const done = poVersionConfirmedResponseSchema.parse(res.body).data;
      expect(done).toMatchObject({ poVersionNo: 2, supersedesPoVersionNo: 1 });
      expect(done.order).toMatchObject({
        orderNo: mine.orderNo,
        captureState: "submitted",
        customerNo: customer.no,
        externalDocumentNo: mine.externalDocumentNo,
        poVersionNo: 2,
        version: 3,
        orderDate: "2026-11-20",
      });
      expect(done.order.lines.map((l) => [l.itemNo, l.quantity])).toEqual([
        [item.no, "8.000"],
        [second.no, "2.000"],
      ]);
      const list = await versionsOf(mine.orderNo);
      expect(list.currentPoVersionNo).toBe(2);
      expect(list.versions.map((v) => [v.poVersionNo, v.current])).toEqual([
        [2, true],
        [1, false],
      ]);
      expect(list.versions[1]?.supersededBy).toEqual(expect.any(String));
      const first = poVersionDetailResponseSchema.parse(
        (await read("SUPPORT", `${P(mine.orderNo)}/1`)).body,
      ).data;
      expect(first).toMatchObject({
        poVersionNo: 1,
        current: false,
        orderDate: "2026-11-10",
        prepaymentPercent: "30.00",
      });
      expect(first.lines.map((l) => [l.itemNo, l.quantity])).toEqual([
        [item.no, "5.000"],
      ]);
      expect(first.lines[0]?.unitPrice.value).toBe("12.50");
      expect(await copiesOf(mine.orderNo)).toBe(1);
    });

    it("stores exactly the differences the preview showed", async () => {
      const mine = await submitted();
      // Decimals the way a person types them: leading zeros and short places.
      const revised = {
        prepaymentPercent: "030",
        lines: [line("007", "12.5"), line("3", "4.4", second.no)],
      };
      const asked = await preview("SUPPORT", mine, revised);
      expect(asked.status, asked.text).toBe(200);
      const previewed = poVersionDifferencesResponseSchema.parse(
        asked.body,
      ).data;
      const done = await confirm("SUPPORT", mine, revised);
      expect(done.status, done.text).toBe(201);
      const confirmed = poVersionConfirmedResponseSchema.parse(done.body).data;
      const stored = poVersionDifferencesResponseSchema.parse(
        (await read("SUPPORT", `${P(mine.orderNo)}/diff?from=1&to=2`)).body,
      ).data;
      expect(JSON.stringify(confirmed.differences)).toBe(
        JSON.stringify(previewed),
      );
      expect(JSON.stringify(stored)).toBe(JSON.stringify(previewed));
      expect(previewed.lines.map((l) => l.status)).toEqual([
        "changed",
        "added",
      ]);
      // 030 is the same percent as 30.00: not a change.
      expect(
        previewed.header.find((h) => h.field === "prepaymentPercent")?.changed,
      ).toBe(false);
    });

    it("a third version: the list holds three, the diff from 1 to 3 pairs the first with the third, and version 2 stays readable", async () => {
      const mine = await submitted();
      expect(
        (await confirm("SUPPORT", mine, { lines: [line("8")] })).status,
      ).toBe(201);
      expect(
        (await confirm("PRODUCT_MANAGER", mine, { lines: [line("9")] }, 2))
          .status,
      ).toBe(201);
      const list = await versionsOf(mine.orderNo);
      expect(list.versions.map((v) => v.poVersionNo)).toEqual([3, 2, 1]);
      const diff = poVersionDifferencesResponseSchema.parse(
        (await read("SUPPORT", `${P(mine.orderNo)}/diff?from=1&to=3`)).body,
      ).data;
      expect(diff.lines).toHaveLength(1);
      expect(diff.lines[0]).toMatchObject({
        status: "changed",
        fromLineNo: 1,
        toLineNo: 1,
        quantity: { from: "5.000", to: "9.000", changed: true },
      });
      const two = poVersionDetailResponseSchema.parse(
        (await read("SUPPORT", `${P(mine.orderNo)}/2`)).body,
      ).data;
      expect(two.lines[0]?.quantity).toBe("8.000");
      expect(two.current).toBe(false);
    });

    it("answers 409 for a stale expectedPoVersionNo, with the current number in the details, and stores nothing", async () => {
      const mine = await submitted();
      expect(
        (await confirm("SUPPORT", mine, { lines: [line("8")] })).status,
      ).toBe(201);
      handoff.confirmed.length = 0;
      const stale = await confirm("SUPPORT", mine, { lines: [line("9")] }, 1);
      expect(stale.status).toBe(409);
      expect(errorOf(stale)).toMatchObject({
        code: "CONFLICT",
        message: `Order ${mine.orderNo} is now at PO version 2, and you compared with PO version 1. Compare again before you confirm.`,
        details: [{ path: "currentPoVersionNo", message: "2" }],
      });
      expect(handoff.confirmed).toHaveLength(0);
      expect(await copiesOf(mine.orderNo)).toBe(1);
      expect((await stateOf(mine.orderNo)).lines[0]?.quantity).toBe("8.000");
      expect(
        await eventsOf("order.po_version_confirmed", mine.orderNo),
      ).toHaveLength(1);
    });

    it("gives [201, 409] for two confirmations at once, with one superseded copy, one audit row and one handoff call", async () => {
      const mine = await submitted();
      // A slow handoff holds the first transaction open while the second
      // request has read the order at PO version 1, so they truly race.
      handoff.next = () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({ effect: "none" });
          }, 300);
        });
      const both = await Promise.all([
        confirm("SUPPORT", mine, { lines: [line("8")] }),
        confirm("PRODUCT_MANAGER", mine, { lines: [line("9")] }),
      ]);
      expect(both.map((r) => r.status).sort()).toEqual([201, 409]);
      const lost = both.find((r) => r.status === 409);
      expect(errorOf(lost ?? { body: {} }).details).toEqual([
        { path: "currentPoVersionNo", message: "2" },
      ]);
      expect(await copiesOf(mine.orderNo)).toBe(1);
      expect(handoff.confirmed).toHaveLength(1);
      expect(
        await eventsOf("order.po_version_confirmed", mine.orderNo),
      ).toHaveLength(1);
      expect((await stateOf(mine.orderNo)).poVersionNo).toBe(2);
    });

    it("pairs a repeated item by occurrence in the stored differences", async () => {
      const mine = await submitted({ lines: [line("2"), line("3")] });
      const done = await confirm(
        "SUPPORT",
        mine,
        { lines: [line("2"), line("3"), line("4")] },
        1,
      );
      expect(done.status, done.text).toBe(201);
      const diff = poVersionDifferencesResponseSchema.parse(
        (await read("SUPPORT", `${P(mine.orderNo)}/diff?from=1&to=2`)).body,
      ).data;
      expect(
        diff.lines.map((l) => [l.status, l.fromLineNo, l.toLineNo]),
      ).toEqual([
        ["unchanged", 1, 1],
        ["unchanged", 2, 2],
        ["added", null, 3],
      ]);
    });

    it("calls the handoff once, inside the transaction, with the next number, the number it supersedes, the person, the time, the new total and percent, and the request's trace id", async () => {
      const mine = await submitted();
      let headDuringCall: string | undefined;
      handoff.next = async () => {
        // A second connection reads what is committed: the move is not yet.
        const { rows } = await db.query<{ poVersionNo: number }>(
          `SELECT "poVersionNo" FROM "SalesOrder" WHERE "orderNo" = $1`,
          [mine.orderNo],
        );
        headDuringCall = String(rows[0]?.poVersionNo);
        return { effect: "none" };
      };
      const res = await call(t, as("SUPPORT"), "post", P(mine.orderNo), {
        csrf: true,
        body: {
          ...bodyOf(mine.externalDocumentNo, {
            prepaymentPercent: "50",
            lines: [line("8", "12.50")],
          }),
          confirmed: true,
          expectedPoVersionNo: 1,
        },
      }).set(HEADERS.requestId, "t-revise-http-1");
      expect(res.status, res.text).toBe(201);
      expect(headDuringCall).toBe("1");
      expect(handoff.confirmed).toHaveLength(1);
      const [fact] = handoff.confirmed;
      expect(fact).toMatchObject({
        orderNo: mine.orderNo,
        poVersionNo: 2,
        supersedesPoVersionNo: 1,
        confirmedBy: { name: expect.any(String) as string, role: "SUPPORT" },
        total: "100.00",
        prepaymentPercent: "50.00",
        request: { traceId: "t-revise-http-1" },
      });
      expect(fact?.confirmedBy.userId).toMatch(/^[0-9a-f-]{36}$/);
      expect(fact?.confirmedAt).toBeInstanceOf(Date);
      const [row] = await eventsOf("order.po_version_confirmed", mine.orderNo);
      expect(row?.traceId).toBe("t-revise-http-1");
    });

    it("leaves nothing stored when the handoff refuses, answers its words, and writes one refusal row", async () => {
      const mine = await submitted();
      handoff.next = () =>
        Promise.reject(new ConflictError("Synthetic refusal words."));
      const res = await confirm("SUPPORT", mine, {
        orderDate: "2026-11-20",
        lines: [line("8")],
      });
      expect(res.status).toBe(409);
      expect(errorOf(res)).toMatchObject({
        code: "CONFLICT",
        message: "Synthetic refusal words.",
      });
      expect(handoff.confirmed).toHaveLength(1);
      // The head, its lines and its number are as they were, and no copy exists.
      const head = await stateOf(mine.orderNo);
      expect(head).toMatchObject({
        poVersionNo: 1,
        version: 2,
        orderDate: "2026-11-10",
      });
      expect(head.lines.map((l) => l.quantity)).toEqual(["5.000"]);
      expect(await copiesOf(mine.orderNo)).toBe(0);
      expect(
        await eventsOf("order.po_version_confirmed", mine.orderNo),
      ).toHaveLength(0);
      const rows = await eventsOf(
        "order.po_version_confirm.refused",
        mine.orderNo,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.changes).toEqual({
        refusedBy: "workflow",
        code: "CONFLICT",
        poVersionNo: { from: 1, to: 2 },
      });
      expect(rows[0]?.summary).toMatch(/was refused by the order flow$/);
      expect(rows[0]?.summary).not.toMatch(/workflow/i);
      expect(JSON.stringify(rows[0])).not.toContain("Synthetic refusal words");
      // Nothing was left half done: the same confirmation goes through once it is fine.
      handoff.next = null;
      expect(
        (
          await confirm("SUPPORT", mine, {
            orderDate: "2026-11-20",
            lines: [line("8")],
          })
        ).status,
      ).toBe(201);
    });

    it("answers a refusal with its own status and code, and audits only the code", async () => {
      const codes: [ErrorCode, number][] = [
        ["VALIDATION_FAILED", 400],
        ["FORBIDDEN", 403],
        ["CONFLICT", 409],
      ];
      for (const [code, status] of codes) {
        const mine = await submitted();
        handoff.next = () =>
          Promise.reject(new DomainError(code, `Words for ${code}.`));
        const res = await confirm("SUPPORT", mine, { lines: [line("8")] });
        expect(res.status, code).toBe(status);
        expect(errorOf(res)).toMatchObject({
          code,
          message: `Words for ${code}.`,
        });
        const rows = await eventsOf(
          "order.po_version_confirm.refused",
          mine.orderNo,
        );
        expect(rows).toHaveLength(1);
        expect(rows[0]?.changes).toMatchObject({ code });
        expect(JSON.stringify(rows[0])).not.toContain(`Words for ${code}`);
      }
    });

    it("leaves nothing stored and writes no row when the handoff throws a plain error", async () => {
      const mine = await submitted();
      handoff.next = () => Promise.reject(new Error("synthetic outage"));
      const res = await confirm("SUPPORT", mine, { lines: [line("8")] });
      expect(res.status).toBe(500);
      expect(errorOf(res).code).toBe("INTERNAL_ERROR");
      expect(JSON.stringify(res.body)).not.toContain("synthetic outage");
      expect(await stateOf(mine.orderNo)).toMatchObject({
        poVersionNo: 1,
        version: 2,
      });
      expect(await copiesOf(mine.orderNo)).toBe(0);
      expect(
        await eventsOf("order.po_version_confirmed", mine.orderNo),
      ).toHaveLength(0);
      expect(
        await eventsOf("order.po_version_confirm.refused", mine.orderNo),
      ).toHaveLength(0);
    });

    it("moves the customer's open orders and the order's list total, and leaves the item's available stock alone", async () => {
      const mine = await submitted({ lines: [line("5", "12.50", second.no)] });
      const stockOf = async () =>
        itemResponseSchema.parse(
          (await read("SUPPORT", `${M}/items/${second.no}`)).body,
        ).data;
      const quantityOnPage = async () =>
        (await stockOf()).orderLines.find((l) => l.orderNo === mine.orderNo)
          ?.quantity;
      const customerPage = async () =>
        customerResponseSchema.parse(
          (await read("SUPPORT", `${M}/customers/${customer.no}`)).body,
        ).data;
      const totalOf = async () => {
        const list = salesOrderListSchema.parse(
          (await read("SUPPORT", `${O}?pageSize=100&source=stored`)).body,
        );
        return list.data.find((r) => r.orderNo === mine.orderNo)?.amount.value;
      };
      const before = await stockOf();
      expect(await quantityOnPage()).toBe("5.000");
      expect(await totalOf()).toBe("62.50");
      expect(
        (
          await confirm("SUPPORT", mine, {
            lines: [line("8", "12.50", second.no)],
          })
        ).status,
      ).toBe(201);
      expect(await quantityOnPage()).toBe("8.000");
      expect(await totalOf()).toBe("100.00");
      expect(
        (await customerPage()).openOrders.find(
          (o) => o.orderNo === mine.orderNo,
        )?.amount.value,
      ).toBe("100.00");
      expect((await stockOf()).availableStock).toBe(before.availableStock);
    });

    it("the list's row count does not change", async () => {
      const mine = await submitted();
      const total = async () =>
        salesOrderListSchema.parse(
          (await read("SUPPORT", `${O}?pageSize=5`)).body,
        ).meta.total;
      const stored = () =>
        t.app.get(SalesOrderRepository, { strict: false }).countAll();
      const before = await total();
      const rows = await stored();
      expect(
        (await confirm("SUPPORT", mine, { lines: [line("8")] })).status,
      ).toBe(201);
      expect(await total()).toBe(before);
      expect(await stored()).toBe(rows);
    });
  });

  describe("prices and the role that may not see them", () => {
    // A price-only revision with odd prices, so that a chance match cannot pass:
    // 229 at 31.97 is 7321.13, and 229 at 33.41 is 7650.89.
    const priced = (price: string) => ({ lines: [line("229", price)] });

    async function twoVersions() {
      const mine = await submitted(priced("31.97"));
      const done = await confirm("SUPPORT", mine, priced("33.41"));
      expect(done.status, done.text).toBe(201);
      return mine;
    }
    const noPrice = (text: string) => {
      for (const price of PRICES_SEEN) expect(text).not.toContain(price);
    };

    it("answers a Warehouse reader the list, a version and a diff with every price masked and no price bytes", async () => {
      const mine = await twoVersions();
      const reads = [
        await read("WAREHOUSE", P(mine.orderNo)),
        await read("WAREHOUSE", `${P(mine.orderNo)}/1`),
        await read("WAREHOUSE", `${P(mine.orderNo)}/2`),
        await read("WAREHOUSE", `${P(mine.orderNo)}/diff?from=1&to=2`),
      ];
      for (const res of reads) {
        expect(res.status, res.text).toBe(200);
        noPrice(res.text);
      }
      const list = poVersionListResponseSchema.parse(reads[0]?.body).data;
      for (const v of list.versions)
        expect(v.total).toMatchObject({ masked: true, value: null });
      const diff = poVersionDifferencesResponseSchema.parse(
        reads[3]?.body,
      ).data;
      expect(diff.pricesCompared).toBe(false);
      expect(diff.identical).toBe(true);
      expect(diff.lines[0]?.status).toBe("unchanged");
      expect(Object.keys(diff.total).sort()).toEqual([
        "classification",
        "field",
        "masked",
        "reason",
      ]);
      expect(Object.keys(diff.lines[0]?.unitPrice ?? {}).sort()).toEqual([
        "classification",
        "field",
        "masked",
        "reason",
      ]);
      // The same two versions are different to a role that sees prices.
      const seen = poVersionDifferencesResponseSchema.parse(
        (await read("SUPPORT", `${P(mine.orderNo)}/diff?from=1&to=2`)).body,
      ).data;
      expect(seen.lines[0]?.status).toBe("changed");
    });

    it("gives Logistics the same", async () => {
      const mine = await twoVersions();
      for (const path of [
        P(mine.orderNo),
        `${P(mine.orderNo)}/1`,
        `${P(mine.orderNo)}/diff?from=1&to=2`,
      ]) {
        const res = await read("LOGISTICS", path);
        expect(res.status, path).toBe(200);
        noPrice(res.text);
      }
      const diff = poVersionDifferencesResponseSchema.parse(
        (await read("LOGISTICS", `${P(mine.orderNo)}/diff?from=1&to=2`)).body,
      ).data;
      expect(diff.pricesCompared).toBe(false);
    });

    describe("a role that may edit orders but sees no prices", () => {
      beforeAll(async () => {
        await t.app
          .get(RolePermissionRepository, { strict: false })
          .grant("WAREHOUSE", "orders.edit");
      });
      afterAll(async () => {
        await t.app
          .get(RolePermissionRepository, { strict: false })
          .revoke("WAREHOUSE", "orders.edit");
      });

      it("is sent no price in the preview or in the answer to a confirmation, whatever the revision changes", async () => {
        const mine = await submitted(priced("31.97"));
        // It cannot send a price: it keeps the stored one by position.
        const revised = {
          orderDate: "2026-11-20",
          lines: [{ itemNo: item.no, quantity: "230" }],
        };
        const asked = await send(
          "WAREHOUSE",
          `${P(mine.orderNo)}/preview`,
          bodyOf(mine.externalDocumentNo, revised),
        );
        expect(asked.status, asked.text).toBe(200);
        noPrice(asked.text);
        const previewed = poVersionDifferencesResponseSchema.parse(
          asked.body,
        ).data;
        expect(previewed.pricesCompared).toBe(false);
        // A masked total has exactly the masked keys: no value, no from, no to.
        expect(Object.keys(previewed.total).sort()).toEqual(MASKED_KEYS);
        expect(previewed.lines[0]?.status).toBe("changed");
        const done = await send("WAREHOUSE", P(mine.orderNo), {
          ...bodyOf(mine.externalDocumentNo, revised),
          confirmed: true,
          expectedPoVersionNo: 1,
        });
        expect(done.status, done.text).toBe(201);
        noPrice(done.text);
        // The order in the answer is masked as every read is.
        const confirmed = poVersionConfirmedResponseSchema.parse(
          done.body,
        ).data;
        expect(confirmed.order.amount.masked).toBe(true);
        expect(Object.keys(confirmed.differences.total).sort()).toEqual(
          MASKED_KEYS,
        );
        expect(JSON.stringify(confirmed.differences)).toBe(
          JSON.stringify(previewed),
        );
        // The stored price is untouched: a role that sees prices still reads it.
        expect((await stateOf(mine.orderNo)).lines[0]?.unitPrice.value).toBe(
          "31.97",
        );
      });
    });
  });

  describe("what the trail and the logs hold", () => {
    it("keeps every price out of the order.po_version_confirmed and order.po_version_confirm.refused events", async () => {
      const mine = await submitted({ lines: [line("229", "31.97")] });
      const refused = await submitted({ lines: [line("229", "31.97")] });
      handoff.next = () => Promise.reject(new ConflictError("Not now."));
      expect(
        (await confirm("SUPPORT", refused, { lines: [line("229", "33.41")] }))
          .status,
      ).toBe(409);
      handoff.next = null;
      expect(
        (await confirm("SUPPORT", mine, { lines: [line("229", "33.41")] }))
          .status,
      ).toBe(201);
      const events = [
        ...(await eventsOf("order.po_version_confirmed", mine.orderNo)),
        ...(await eventsOf(
          "order.po_version_confirm.refused",
          refused.orderNo,
        )),
      ];
      expect(events).toHaveLength(2);
      for (const event of events) {
        const keys = Object.keys(event.changes ?? {});
        for (const forbidden of [
          "total",
          "unitPrice",
          "amount",
          "lines.unitPrice",
        ])
          expect(keys).not.toContain(forbidden);
        if ("lines" in (event.changes ?? {}))
          expect(typeof event.changes?.lines).toBe("number");
        // The words and the changes only: the stored event also holds a random
        // id and two 64-character hashes, where "7321" can turn up by chance.
        const text = `${event.summary} ${JSON.stringify(event.changes)}`;
        for (const price of ["31.97", "33.41", "7321.13", "7650.89", "7321"])
          expect(text).not.toContain(price);
      }
    });

    it("names who, the two numbers and the changed header fields without the total", async () => {
      const mine = await submitted();
      const res = await confirm("SUPPORT", mine, {
        orderDate: "2026-11-20",
        prepaymentPercent: "50",
        lines: [line("8"), line("1", "3.00", second.no)],
      });
      expect(res.status, res.text).toBe(201);
      const [row] = await eventsOf("order.po_version_confirmed", mine.orderNo);
      expect(row?.actor).toMatchObject({ kind: "user", role: "SUPPORT" });
      expect(row?.summary).toBe(
        `${as("SUPPORT").session.user.displayName} confirmed PO version 2 of order ${mine.orderNo}`,
      );
      expect(row?.changes).toEqual({
        poVersionNo: { from: 1, to: 2 },
        version: { from: 2, to: 3 },
        lines: 2,
        headerFields: ["orderDate", "prepaymentPercent"],
        lineChanges: { added: 1, removed: 0, changed: 1, moved: 0 },
        workflowEffect: "none",
      });
    });

    it("a failed write leaves no price in the answer or the log", async () => {
      const mine = await submitted();
      // A NUL cannot be stored in text, so the lines fail to write after the
      // copy and the move, with the odd price in the failed call's arguments.
      const res = await confirm("SUPPORT", mine, {
        lines: [{ ...line("8", "47.39"), description: "bad\u0000text" }],
      });
      expect(res.status).toBe(500);
      expect(errorOf(res).code).toBe("INTERNAL_ERROR");
      expect(res.text).not.toContain("47.39");
      const logged = JSON.stringify(t.logLines());
      expect(logged).toContain("could not be stored");
      expect(logged).not.toContain("47.39");
      expect(await stateOf(mine.orderNo)).toMatchObject({
        poVersionNo: 1,
        version: 2,
      });
      expect(await copiesOf(mine.orderNo)).toBe(0);
      expect(handoff.confirmed).toHaveLength(0);
    });
  });

  describe("the duplicate rule", () => {
    it("a re-sent PO to POST /orders is still the 409 that names the order, before and after a revision", async () => {
      const mine = await submitted();
      const resend = async () => {
        const res = await send("SUPPORT", O, bodyOf(mine.externalDocumentNo));
        expect(res.status, res.text).toBe(409);
        expect(existingOrderOf(errorOf(res).details as never)).toBe(
          mine.orderNo,
        );
      };
      await resend();
      expect(
        (await confirm("SUPPORT", mine, { lines: [line("8")] })).status,
      ).toBe(201);
      await resend();
    });

    it("the preview writes nothing: no row, no copy, no audit event, no handoff call", async () => {
      const mine = await submitted();
      const events = (await auditEvents(t)).length;
      const stored = await stateOf(mine.orderNo);
      for (const over of [
        { lines: [line("8")] },
        {},
        { orderDate: "2026-11-20" },
      ]) {
        const res = await preview("SUPPORT", mine, over);
        expect(res.status, res.text).toBe(200);
      }
      expect(await copiesOf(mine.orderNo)).toBe(0);
      expect(await stateOf(mine.orderNo)).toEqual(stored);
      expect((await auditEvents(t)).length).toBe(events);
      expect(handoff.confirmed).toHaveLength(0);
    });
  });
});
