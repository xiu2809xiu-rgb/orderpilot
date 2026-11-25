import { ROLES, type Role } from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoEmail } from "../../src/auth/demo-accounts.js";
import type { OrderActor } from "../../src/modules/workflows/domain/order-state-machine.js";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import { UserRepository } from "../../src/users/user.repository.js";
import {
  API,
  auditEvents,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const W = `${API}/workflows`;
const INFO = { ip: null, traceId: "sales-approval-test" };
const DATA = syntheticDataset();
/** A seeded order the machine runs at the stock check: nobody raised it. */
const SEEDED = DATA.orders.find(
  (order) =>
    order.sampleScreenState === "sample-pi-to-send" &&
    order.stockShortfall === null &&
    Number(order.header.prepaymentPercent) === 0,
);

describe("the sales approval, off by default, on here (#251, point 9)", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  let next = 0;

  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`No session for ${role}`);
    return browser;
  };
  const actorOf = async (role: Role): Promise<OrderActor> => {
    const user = await t.app.get(UserRepository).findByEmail(demoEmail(role));
    if (!user) throw new Error(`No demo user for ${role}`);
    return { kind: "user", userId: user.id, name: user.displayName, role };
  };
  const workflow = () => t.app.get(OrderWorkflowService);

  /** A new order Support raises and checks, ready for its PI but for the approval. */
  async function readyOrder(): Promise<string> {
    next += 1;
    const orderNo = `SO-SALES-${String(next)}`;
    const support = await actorOf("SUPPORT");
    await workflow().start(
      orderNo,
      { prepaymentDue: null, total: "1200.00" },
      support,
      INFO,
    );
    await workflow().apply(
      orderNo,
      { type: "FIELDS_CONFIRMED", allFieldsConfirmed: true },
      support,
      INFO,
    );
    await workflow().apply(
      orderNo,
      { type: "STOCK_CHECKED", stockCoversOrder: true },
      await actorOf("PRODUCT_MANAGER"),
      INFO,
    );
    return orderNo;
  }
  const approve = (role: Role, orderNo: string) =>
    call(t, as(role), "post", `${W}/orders/${orderNo}/sales-approval`, {
      csrf: true,
      body: { comment: "Margin checked." },
    });
  const undo = (role: Role, orderNo: string) =>
    call(t, as(role), "post", `${W}/orders/${orderNo}/sales-approval/undo`, {
      csrf: true,
    });
  const sendPi = async (orderNo: string) =>
    workflow().apply(
      orderNo,
      { type: "PI_SENT" },
      await actorOf("SUPPORT"),
      INFO,
    );
  const refusalsOf = async (orderNo: string) =>
    (await auditEvents(t)).filter(
      (event) =>
        event.entityId === orderNo &&
        event.action === "workflows.sales.refused",
    );

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ APPROVER_GROUP: "on", SALES_APPROVAL: "on" });
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });

  it("holds the PI until an approver approves the sale, and waits on the approvers meanwhile", async () => {
    const orderNo = await readyOrder();

    await expect(sendPi(orderNo)).rejects.toThrow(/sales approval/);
    expect(await workflow().statusOf(orderNo)).toMatchObject({
      status: "StockChecked",
      ownerRole: "APPROVER",
    });

    const res = await approve("APPROVER", orderNo);

    expect(res.status).toBe(200);
    expect(
      (await auditEvents(t)).some(
        (event) =>
          event.entityId === orderNo &&
          event.action === "workflows.sales.approved",
      ),
    ).toBe(true);
    await sendPi(orderNo);
    expect((await workflow().statusOf(orderNo))?.status).toBe(
      "AwaitingPayment",
    );
  });

  it("refuses a second approval", async () => {
    const orderNo = await readyOrder();
    await approve("APPROVER", orderNo);
    expect((await approve("APPROVER", orderNo)).status).toBe(409);
  });

  it("lets only the approver undo it, and audits anyone else's try", async () => {
    const orderNo = await readyOrder();
    await approve("APPROVER", orderNo);

    // Management holds approvals.decide but did not approve it.
    expect((await undo("MANAGEMENT", orderNo)).status).toBe(403);
    expect((await refusalsOf(orderNo)).at(-1)?.changes).toMatchObject({
      rule: "not-the-decider",
    });

    expect((await undo("APPROVER", orderNo)).status).toBe(200);
    await expect(sendPi(orderNo)).rejects.toThrow(/sales approval/);
  });

  it("refuses someone outside the approver group through area 4's policy, and a role without the permission at the guard", async () => {
    const orderNo = await readyOrder();
    expect((await approve("MANAGEMENT", orderNo)).status).toBe(403);
    expect(
      (await auditEvents(t)).some(
        (event) =>
          event.entityId === orderNo &&
          event.action === "governance.policy.refused",
      ),
    ).toBe(true);
    expect((await approve("WAREHOUSE", orderNo)).status).toBe(403);
    await expect(sendPi(orderNo)).rejects.toThrow(/sales approval/);
  });

  it("refuses an order nobody is known to have raised, and audits why", async () => {
    if (!SEEDED) throw new Error("No seeded order at the stock check");
    const orderNo = SEEDED.header.no;

    const res = await approve("APPROVER", orderNo);

    expect(res.status).toBe(409);
    expect((await refusalsOf(orderNo)).at(-1)?.changes).toMatchObject({
      rule: "requester-unknown",
    });
  });
});

describe("the sales approval, while SALES_APPROVAL is off (the default)", () => {
  let t: TestApp;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ APPROVER_GROUP: "on" });
  });
  afterAll(async () => {
    await t.close();
  });

  it("lets the PI go without one, and refuses an approval nobody asked for", async () => {
    const support = await t.app
      .get(UserRepository)
      .findByEmail(demoEmail("SUPPORT"));
    const manager = await t.app
      .get(UserRepository)
      .findByEmail(demoEmail("PRODUCT_MANAGER"));
    if (!support || !manager) throw new Error("No demo users");
    const workflow = t.app.get(OrderWorkflowService);
    const as = (user: typeof support, role: Role): OrderActor => ({
      kind: "user",
      userId: user.id,
      name: user.displayName,
      role,
    });
    const orderNo = "SO-SALES-OFF";
    await workflow.start(
      orderNo,
      { prepaymentDue: null },
      as(support, "SUPPORT"),
      INFO,
    );
    await workflow.apply(
      orderNo,
      { type: "FIELDS_CONFIRMED", allFieldsConfirmed: true },
      as(support, "SUPPORT"),
      INFO,
    );
    await workflow.apply(
      orderNo,
      { type: "STOCK_CHECKED", stockCoversOrder: true },
      as(manager, "PRODUCT_MANAGER"),
      INFO,
    );
    const approver = await demoSignIn(t, "APPROVER");

    const res = await call(
      t,
      approver,
      "post",
      `${W}/orders/${orderNo}/sales-approval`,
      { csrf: true, body: { comment: "Not needed." } },
    );

    expect(res.status).toBe(409);
    await workflow.apply(
      orderNo,
      { type: "PI_SENT" },
      as(support, "SUPPORT"),
      INFO,
    );
    expect((await workflow.statusOf(orderNo))?.status).toBe("AwaitingPayment");
  });
});
