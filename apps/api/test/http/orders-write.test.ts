import {
  ROLES,
  existingOrderOf,
  salesOrderResponseSchema,
  type Role,
  type SalesOrderDetail,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuditService } from "../../src/audit/audit.service.js";
import { RolePermissionRepository } from "../../src/auth/role-permission.repository.js";
import { SalesOrderRepository } from "../../src/modules/orders/sales-order.repository.js";
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
const NUMBER = /^SO-\d{8}-\d{4}$/;

describe("writing draft orders over HTTP", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  const dataset = syntheticDataset();
  const [customer, other] = dataset.customers;
  const [item, second] = dataset.items;
  if (!customer || !other || !item || !second)
    throw new Error("the set is empty");

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });

  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`no session for ${role}`);
    return browser;
  };
  const send = (
    method: "post" | "patch",
    role: Role,
    path: string,
    body: object,
    csrf: boolean | string = true,
  ) => call(t, as(role), method, path, { csrf, body });
  const read = (role: Role, path: string) => call(t, as(role), "get", path);

  let sequence = 0;
  const newPo = () => `PO-W-${String((sequence += 1))}`;
  const body = (over: Record<string, unknown> = {}) => ({
    customerNo: customer.no,
    externalDocumentNo: newPo(),
    orderDate: "2026-11-10",
    shipmentDate: null,
    prepaymentPercent: "30",
    lines: [{ itemNo: item.no, quantity: "5", unitPrice: "12.50" }],
    ...over,
  });
  const detail = (res: { body: unknown }): SalesOrderDetail =>
    salesOrderResponseSchema.parse(res.body).data;
  const create = async (
    role: Role = "SUPPORT",
    over: Record<string, unknown> = {},
  ) => {
    const res = await send("post", role, O, body(over));
    expect(res.status, res.text).toBe(201);
    return detail(res);
  };
  const storedCount = () =>
    t.app.get(SalesOrderRepository, { strict: false }).countAll();
  const refusals = async () =>
    (await auditEvents(t)).filter((e) => e.action === "auth.permission.refused")
      .length;
  const errorOf = (res: { body: unknown }) =>
    (
      res.body as {
        error: { code: string; message: string; details: unknown };
      }
    ).error;

  describe("every route", () => {
    it("answers 401 with no session", async () => {
      const paths = [
        ["post", O],
        ["patch", `${O}/SO-20261110-0001`],
        ["post", `${O}/SO-20261110-0001/void`],
      ] as const;
      for (const [method, path] of paths) {
        const res = await call(t, null, method, path, { body: { a: 1 } });
        expect(res.status, path).toBe(401);
      }
    });

    it("answers 403 to Warehouse, Auditor and System admin, audits it and writes nothing", async () => {
      const mine = await create();
      const before = await storedCount();
      for (const role of ["WAREHOUSE", "AUDITOR", "SYSTEM_ADMIN"] as const) {
        const calls = [
          () => send("post", role, O, body()),
          () =>
            send("patch", role, `${O}/${mine.orderNo}`, {
              version: 1,
              prepaymentPercent: "10",
            }),
          () =>
            send("post", role, `${O}/${mine.orderNo}/void`, {
              version: 1,
              reason: "No.",
            }),
        ];
        for (const run of calls) {
          const marked = await refusals();
          const res = await run();
          expect(res.status, `${role} ${res.text}`).toBe(403);
          expect(await refusals()).toBe(marked + 1);
        }
      }
      expect(await storedCount()).toBe(before);
      const after = detail(await read("SUPPORT", `${O}/${mine.orderNo}`));
      expect(after.version).toBe(1);
      expect(after.captureState).toBe("draft");
      expect(after.prepaymentPercent).toBe("30.00");
    });

    it("answers CSRF_INVALID without the header on every write, and writes nothing", async () => {
      const mine = await create();
      const before = await storedCount();
      const calls = [
        () => send("post", "SUPPORT", O, body(), false),
        () =>
          send(
            "patch",
            "SUPPORT",
            `${O}/${mine.orderNo}`,
            { version: 1, prepaymentPercent: "10" },
            false,
          ),
        () =>
          send(
            "post",
            "SUPPORT",
            `${O}/${mine.orderNo}/void`,
            { version: 1, reason: "No csrf." },
            false,
          ),
      ];
      for (const run of calls) {
        const res = await run();
        expect(res.status, res.text).toBe(403);
        expect(errorOf(res).code).toBe("CSRF_INVALID");
      }
      expect(await storedCount()).toBe(before);
      const after = detail(await read("SUPPORT", `${O}/${mine.orderNo}`));
      expect(after).toMatchObject({
        version: 1,
        captureState: "draft",
        prepaymentPercent: "30.00",
      });
    });

    it("answers 404 for an unknown number and for a sample", async () => {
      for (const no of ["SO-20990101-0001", "SO-0001"]) {
        const patch = await send("patch", "SUPPORT", `${O}/${no}`, {
          version: 1,
          prepaymentPercent: "10",
        });
        expect(patch.status, no).toBe(404);
        expect(errorOf(patch).code).toBe("NOT_FOUND");
        const voided = await send("post", "SUPPORT", `${O}/${no}/void`, {
          version: 1,
          reason: "Wrong order.",
        });
        expect(voided.status, no).toBe(404);
      }
    });
  });

  describe("validation", () => {
    const refused = async (
      over: Record<string, unknown>,
      path: string,
      role: Role = "SUPPORT",
    ) => {
      const before = await storedCount();
      const res = await send("post", role, O, body(over));
      expect(res.status, JSON.stringify(over)).toBe(400);
      const error = errorOf(res);
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(JSON.stringify(error.details)).toContain(path);
      expect(await storedCount()).toBe(before);
    };
    const line = (over: Record<string, unknown>) => ({
      lines: [{ itemNo: item.no, quantity: "5", unitPrice: "12.50", ...over }],
    });

    it("refuses a bad date, no lines and a missing PO number", async () => {
      await refused({ orderDate: "10/11/2026" }, "orderDate");
      await refused({ lines: [] }, "lines");
      await refused({ externalDocumentNo: "   " }, "externalDocumentNo");
    });

    it("refuses a shipment date before the order date, at the field, and stores nothing", async () => {
      const before = await storedCount();
      const res = await send(
        "post",
        "SUPPORT",
        O,
        body({ orderDate: "2026-11-20", shipmentDate: "2020-01-01" }),
      );
      expect(res.status).toBe(400);
      const error = errorOf(res);
      expect(error.code).toBe("VALIDATION_FAILED");
      expect(error.details).toEqual([
        expect.objectContaining({ path: "shipmentDate" }),
      ]);
      expect(await storedCount()).toBe(before);
    });

    it("refuses a change whose dates leave the shipment before the order, sent together or against the stored one", async () => {
      const order = await create("SUPPORT", {
        orderDate: "2026-11-10",
        shipmentDate: "2026-11-15",
      });
      const both = await send("patch", "SUPPORT", `${O}/${order.orderNo}`, {
        version: 1,
        orderDate: "2026-11-20",
        shipmentDate: "2026-11-01",
      });
      expect(both.status).toBe(400);
      const alone = await send("patch", "SUPPORT", `${O}/${order.orderNo}`, {
        version: 1,
        orderDate: "2026-11-25",
      });
      expect(alone.status, alone.text).toBe(400);
      expect(errorOf(alone).details).toEqual([
        expect.objectContaining({ path: "shipmentDate" }),
      ]);
      const fine = await send("patch", "SUPPORT", `${O}/${order.orderNo}`, {
        version: 1,
        shipmentDate: "2026-11-10",
      });
      expect(fine.status, fine.text).toBe(200);
    });

    it("refuses a zero quantity at the line's own index, and a 3-decimal price", async () => {
      await refused(line({ quantity: "0" }), "lines.0.quantity");
      await refused(line({ quantity: "1.0001" }), "lines.0.quantity");
      await refused(line({ unitPrice: "1.005" }), "lines.0.unitPrice");
    });

    it("refuses an unknown customer and an unknown item", async () => {
      await refused({ customerNo: "C-NOPE" }, "customerNo");
      await refused(line({ itemNo: "I-NOPE" }), "lines.0.itemNo");
    });

    it("refuses a missing price from a role that sees prices", async () => {
      await refused(
        { lines: [{ itemNo: item.no, quantity: "5" }] },
        "lines.0.unitPrice",
      );
    });

    it("refuses 201 lines and takes 200", async () => {
      const many = (count: number) => ({
        lines: Array.from({ length: count }, () => ({
          itemNo: item.no,
          quantity: "1",
          unitPrice: "1.00",
        })),
      });
      await refused(many(201), "lines");
      const res = await send("post", "SUPPORT", O, body(many(200)));
      expect(res.status, res.text).toBe(201);
    });

    it("refuses lines whose total is too large to hold, at lines", async () => {
      const big = {
        itemNo: item.no,
        quantity: "1",
        unitPrice: "999999999999999",
      };
      await refused({ lines: [big, big] }, "lines");
    });

    it("refuses an empty change and a change with no version", async () => {
      const mine = await create();
      for (const bad of [{ version: 1 }, { prepaymentPercent: "10" }]) {
        const res = await send("patch", "SUPPORT", `${O}/${mine.orderNo}`, bad);
        expect(res.status).toBe(400);
      }
    });

    it("refuses a void with a blank reason, and leaves the draft", async () => {
      const mine = await create();
      for (const reason of [" ", "   "]) {
        const res = await send("post", "SUPPORT", `${O}/${mine.orderNo}/void`, {
          version: 1,
          reason,
        });
        expect(res.status, res.text).toBe(400);
        expect(errorOf(res).code).toBe("VALIDATION_FAILED");
        expect(JSON.stringify(errorOf(res).details)).toContain("reason");
      }
      expect(
        detail(await read("SUPPORT", `${O}/${mine.orderNo}`)).captureState,
      ).toBe("draft");
    });
  });

  describe("creating", () => {
    it.each(["SUPPORT", "PRODUCT_MANAGER"] as const)(
      "lets %s start a draft at version 1 that ships what it asks for",
      async (role) => {
        const made = await create(role, {
          externalDocumentNo: `  po  ${role} `,
        });
        expect(made.orderNo).toMatch(NUMBER);
        expect(made).toMatchObject({
          source: "stored",
          captureState: "draft",
          version: 1,
          customerNo: customer.no,
          externalDocumentNo: `po ${role}`,
          currencyCode: "USD",
          prepaymentPercent: "30.00",
        });
        expect(made.lines[0]).toMatchObject({
          lineNo: 1,
          itemNo: item.no,
          quantity: "5.000",
          qtyToShip: "5.000",
        });
        expect(made.lines[0]?.description).toBe(item.description);
      },
    );

    it("audits the creation without a price, and the operation log returns it", async () => {
      const made = await create();
      const event = (await auditEvents(t)).find(
        (e) => e.action === "order.created" && e.entityId === made.orderNo,
      );
      expect(event?.entityType).toBe("Order");
      expect(event?.actor).toMatchObject({ role: "SUPPORT" });
      expect(JSON.stringify(event?.changes)).not.toMatch(/12\.5|unitPrice/);
      const log = await read(
        "SUPPORT",
        `${API}/operation-log/Order/${made.orderNo}`,
      );
      expect(log.status).toBe(200);
      expect(JSON.stringify(log.body)).toContain("created draft order");
    });

    it("treats a sample's PO number as no duplicate", async () => {
      const sample = dataset.orders[0];
      if (!sample) throw new Error("fixture");
      const res = await send(
        "post",
        "SUPPORT",
        O,
        body({
          customerNo: sample.header.sellToCustomerNo,
          externalDocumentNo: sample.header.externalDocumentNo,
        }),
      );
      expect(res.status, res.text).toBe(201);
    });
  });

  describe("the duplicate rule", () => {
    it("names the existing order, whatever the case and spacing", async () => {
      const first = await create("SUPPORT", { externalDocumentNo: "PO-Dup 1" });
      const res = await send(
        "post",
        "PRODUCT_MANAGER",
        O,
        body({ externalDocumentNo: "  po-dup   1" }),
      );
      expect(res.status).toBe(409);
      const error = errorOf(res);
      expect(error.code).toBe("CONFLICT");
      expect(existingOrderOf(error.details as never)).toBe(first.orderNo);
    });

    it("takes a space inside the PO number for no difference, and stores it as typed", async () => {
      const first = await create("SUPPORT", {
        externalDocumentNo: "AUD-DUP-011930",
      });
      const res = await send(
        "post",
        "SUPPORT",
        O,
        body({ externalDocumentNo: "AUD-DUP- 011930" }),
      );
      expect(res.status, res.text).toBe(409);
      expect(existingOrderOf(errorOf(res).details as never)).toBe(
        first.orderNo,
      );
      const spaced = await create("SUPPORT", {
        externalDocumentNo: "AUD-SP 7 7",
      });
      expect(spaced.externalDocumentNo).toBe("AUD-SP 7 7");
      const again = await send(
        "post",
        "SUPPORT",
        O,
        body({ externalDocumentNo: "aud-sp77" }),
      );
      expect(again.status, again.text).toBe(409);
    });

    it("lets another customer use the same PO number", async () => {
      await create("SUPPORT", { externalDocumentNo: "PO-Shared" });
      await create("SUPPORT", {
        externalDocumentNo: "PO-Shared",
        customerNo: other.no,
      });
    });

    it("refuses a change onto another order's PO number, but not onto its own", async () => {
      const first = await create("SUPPORT", { externalDocumentNo: "PO-Own-1" });
      const second = await create("SUPPORT", {
        externalDocumentNo: "PO-Own-2",
      });
      const same = await send("patch", "SUPPORT", `${O}/${first.orderNo}`, {
        version: 1,
        externalDocumentNo: "po-own-1",
      });
      expect(same.status, same.text).toBe(200);
      const clash = await send("patch", "SUPPORT", `${O}/${second.orderNo}`, {
        version: 1,
        externalDocumentNo: "PO-OWN-1",
      });
      expect(clash.status).toBe(409);
      expect(existingOrderOf(errorOf(clash).details as never)).toBe(
        first.orderNo,
      );
    });

    it("gives [201, 409] for two parallel posts, and stores one row", async () => {
      const before = await storedCount();
      const same = body({ externalDocumentNo: "PO-Race" });
      const answers = await Promise.all([
        send("post", "SUPPORT", O, same),
        send("post", "PRODUCT_MANAGER", O, same),
      ]);
      expect(answers.map((a) => a.status).sort()).toEqual([201, 409]);
      expect(await storedCount()).toBe(before + 1);
      const [one, two] = answers;
      const [loser, winner] = one.status === 409 ? [one, two] : [two, one];
      expect(existingOrderOf(errorOf(loser).details as never)).toBe(
        detail(winner).orderNo,
      );
    });

    it("gives [200, 409] for two parallel changes onto one PO number", async () => {
      const a = await create("SUPPORT", { externalDocumentNo: "PO-Move-A" });
      const b = await create("SUPPORT", { externalDocumentNo: "PO-Move-B" });
      const answers = await Promise.all(
        [a, b].map((order) =>
          send("patch", "SUPPORT", `${O}/${order.orderNo}`, {
            version: 1,
            externalDocumentNo: "PO-Target",
          }),
        ),
      );
      expect(answers.map((r) => r.status).sort()).toEqual([200, 409]);
    });
  });

  describe("changing", () => {
    it("keeps what was not sent, bumps the version and renumbers the lines", async () => {
      const made = await create("SUPPORT");
      const res = await send(
        "patch",
        "PRODUCT_MANAGER",
        `${O}/${made.orderNo}`,
        {
          version: 1,
          shipmentDate: "2026-12-01",
          lines: [
            { itemNo: item.no, quantity: "2", unitPrice: "10.00" },
            { itemNo: second.no, quantity: "3", unitPrice: "1.00" },
          ],
        },
      );
      expect(res.status, res.text).toBe(200);
      const changed = detail(res);
      expect(changed.version).toBe(2);
      expect(changed.prepaymentPercent).toBe("30.00");
      expect(changed.shipmentDate).toBe("2026-12-01");
      expect(changed.externalDocumentNo).toBe(made.externalDocumentNo);
      expect(changed.lines.map((l) => l.lineNo)).toEqual([1, 2]);
      expect(changed.lines.map((l) => l.qtyToShip)).toEqual(["2.000", "3.000"]);
      const audited = (await auditEvents(t)).find(
        (e) => e.action === "order.updated" && e.entityId === made.orderNo,
      );
      expect(JSON.stringify(audited?.changes)).not.toMatch(/10\.00|unitPrice/);
    });

    it("answers 409 for a stale version and changes nothing", async () => {
      const made = await create("SUPPORT");
      expect(
        (
          await send("patch", "SUPPORT", `${O}/${made.orderNo}`, {
            version: 1,
            prepaymentPercent: "40",
          })
        ).status,
      ).toBe(200);
      const stale = await send("patch", "SUPPORT", `${O}/${made.orderNo}`, {
        version: 1,
        prepaymentPercent: "50",
      });
      expect(stale.status).toBe(409);
      const now = detail(await read("SUPPORT", `${O}/${made.orderNo}`));
      expect(now).toMatchObject({ version: 2, prepaymentPercent: "40.00" });
    });

    it("refuses a submitted and a void order with a 409", async () => {
      const submitted = await create("SUPPORT");
      const closed = await create("SUPPORT");
      const repo = t.app.get(SalesOrderRepository, { strict: false });
      expect(await repo.markVoid(closed.orderNo, 1)).toBe(true);
      const { Database } = await import("../../src/database/database.js");
      await t.app.get(Database, { strict: false }).client.salesOrder.update({
        where: { orderNo: submitted.orderNo },
        data: { captureState: "SUBMITTED" },
      });
      for (const order of [submitted, closed]) {
        const patch = await send("patch", "SUPPORT", `${O}/${order.orderNo}`, {
          version: order === closed ? 2 : 1,
          prepaymentPercent: "10",
        });
        expect(patch.status, order.orderNo).toBe(409);
        const voided = await send(
          "post",
          "SUPPORT",
          `${O}/${order.orderNo}/void`,
          {
            version: order === closed ? 2 : 1,
            reason: "Too late.",
          },
        );
        expect(voided.status, order.orderNo).toBe(409);
      }
    });

    it("gives the draft rule's words, not the stale one, for a closed order with an old version", async () => {
      const closed = await create("SUPPORT");
      const repo = t.app.get(SalesOrderRepository, { strict: false });
      expect(await repo.markVoid(closed.orderNo, 1)).toBe(true);
      const patch = await send("patch", "SUPPORT", `${O}/${closed.orderNo}`, {
        version: 1,
        prepaymentPercent: "10",
      });
      expect(patch.status).toBe(409);
      expect(errorOf(patch).message).toContain("Only a draft can");
      const voided = await send(
        "post",
        "SUPPORT",
        `${O}/${closed.orderNo}/void`,
        { version: 1, reason: "Again." },
      );
      expect(voided.status).toBe(409);
      expect(errorOf(voided).message).toContain("Only a draft can");
    });
  });

  describe("voiding", () => {
    it("voids a draft with a reason, audits it and frees the PO number", async () => {
      const made = await create("SUPPORT", { externalDocumentNo: "PO-Void-1" });
      const res = await send(
        "post",
        "PRODUCT_MANAGER",
        `${O}/${made.orderNo}/void`,
        {
          version: 1,
          reason: "Entered twice.",
        },
      );
      expect(res.status, res.text).toBe(200);
      expect(detail(res)).toMatchObject({ captureState: "void", version: 2 });
      const event = (await auditEvents(t)).find(
        (e) => e.action === "order.voided" && e.entityId === made.orderNo,
      );
      expect(event?.changes).toMatchObject({ reason: "Entered twice." });
      await create("SUPPORT", { externalDocumentNo: "PO-Void-1" });
    });

    it("answers 409 for a stale version", async () => {
      const made = await create("SUPPORT");
      const res = await send("post", "SUPPORT", `${O}/${made.orderNo}/void`, {
        version: 7,
        reason: "Wrong.",
      });
      expect(res.status).toBe(409);
      expect(
        detail(await read("SUPPORT", `${O}/${made.orderNo}`)).captureState,
      ).toBe("draft");
    });
  });

  describe("a failing audit", () => {
    it("leaves no order and no gap in the numbers", async () => {
      const before = await storedCount();
      const last = await create("SUPPORT");
      const spy = vi
        .spyOn(t.app.get(AuditService, { strict: false }), "record")
        .mockRejectedValueOnce(new Error("audit is down"));
      const res = await send("post", "SUPPORT", O, body());
      spy.mockRestore();
      expect(res.status).toBe(500);
      expect(await storedCount()).toBe(before + 1);
      const next = await create("SUPPORT");
      const serial = (no: string) => Number(no.slice(-4));
      expect(serial(next.orderNo)).toBe(serial(last.orderNo) + 1);
    });
  });

  describe("a role that sees no prices but may write", () => {
    beforeAll(async () => {
      await t.app
        .get(RolePermissionRepository, { strict: false })
        .grant("WAREHOUSE", "orders.create");
      await t.app
        .get(RolePermissionRepository, { strict: false })
        .grant("WAREHOUSE", "orders.edit");
    });

    afterAll(async () => {
      const permissions = t.app.get(RolePermissionRepository, {
        strict: false,
      });
      await permissions.revoke("WAREHOUSE", "orders.create");
      await permissions.revoke("WAREHOUSE", "orders.edit");
    });

    it("is refused a price it sends, and a new line with none: the PO's price is typed by a role that sees prices", async () => {
      const before = await storedCount();
      const sent = await send(
        "post",
        "WAREHOUSE",
        O,
        body({
          lines: [{ itemNo: item.no, quantity: "1", unitPrice: "1.00" }],
        }),
      );
      expect(sent.status).toBe(400);
      expect(JSON.stringify(errorOf(sent).details)).toContain(
        "lines.0.unitPrice",
      );
      const none = await send(
        "post",
        "WAREHOUSE",
        O,
        body({ lines: [{ itemNo: item.no, quantity: "1" }] }),
      );
      expect(none.status, none.text).toBe(400);
      expect(JSON.stringify(errorOf(none).details)).toContain(
        "lines.0.unitPrice",
      );
      expect(await storedCount()).toBe(before);
    });

    it("keeps a negotiated price when it edits the line's quantity", async () => {
      const made = await create("SUPPORT", {
        lines: [{ itemNo: item.no, quantity: "2", unitPrice: "3.25" }],
      });
      const res = await send("patch", "WAREHOUSE", `${O}/${made.orderNo}`, {
        version: 1,
        lines: [{ itemNo: item.no, quantity: "4" }],
      });
      expect(res.status, res.text).toBe(200);
      expect(detail(res).lines[0]?.unitPrice.masked).toBe(true);
      const seen = detail(await read("SUPPORT", `${O}/${made.orderNo}`));
      expect(seen.lines[0]).toMatchObject({ quantity: "4.000" });
      expect(seen.lines[0]?.unitPrice.value).toBe("3.25");
    });

    it("keeps each line's own price when one item is on two lines", async () => {
      const made = await create("SUPPORT", {
        lines: [
          { itemNo: item.no, quantity: "1", unitPrice: "3.00" },
          { itemNo: item.no, quantity: "1", unitPrice: "7.00" },
        ],
      });
      const res = await send("patch", "WAREHOUSE", `${O}/${made.orderNo}`, {
        version: 1,
        lines: [
          { itemNo: item.no, quantity: "2" },
          { itemNo: item.no, quantity: "2" },
        ],
      });
      expect(res.status, res.text).toBe(200);
      const seen = detail(await read("SUPPORT", `${O}/${made.orderNo}`));
      expect(seen.lines.map((l) => l.unitPrice.value)).toEqual([
        "3.00",
        "7.00",
      ]);
    });

    it("refuses a line whose position or item no longer matches a stored one", async () => {
      const made = await create("SUPPORT", {
        lines: [{ itemNo: item.no, quantity: "1", unitPrice: "3.00" }],
      });
      const res = await send("patch", "WAREHOUSE", `${O}/${made.orderNo}`, {
        version: 1,
        lines: [
          { itemNo: second.no, quantity: "1" },
          { itemNo: item.no, quantity: "1" },
        ],
      });
      expect(res.status).toBe(400);
      expect(JSON.stringify(errorOf(res).details)).toContain(
        "lines.0.unitPrice",
      );
      expect(JSON.stringify(errorOf(res).details)).toContain(
        "lines.1.unitPrice",
      );
    });
  });
});
