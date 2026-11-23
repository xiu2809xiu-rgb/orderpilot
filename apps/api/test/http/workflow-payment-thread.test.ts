import { ROLES, type Role, type WorkflowTask } from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import { WorkflowTaskRepository } from "../../src/modules/workflows/workflow-task.repository.js";
import {
  orderFlowResponseSchema,
  paymentResponseSchema,
} from "../../src/modules/workflows/workflows.schemas.js";
import {
  API,
  auditCount,
  call,
  demoSignIn,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const W = `${API}/workflows`;
const DATA = syntheticDataset();

/** The orders waiting for a prepayment, each with the amount Finance expects. */
const AWAITING = DATA.orders.flatMap((order) => {
  const expected = DATA.payments.find(
    (payment) =>
      payment.orderNo === order.header.no &&
      payment.status === "expected" &&
      payment.paymentType === "prepayment",
  );
  return order.sampleScreenState === "sample-awaiting-payment" && expected
    ? [{ orderNo: order.header.no, amount: expected.amount }]
    : [];
});
/** An order whose only expected payment is a deposit, which never opens the gate. */
const DEPOSIT_ONLY = DATA.orders.find(
  (order) =>
    order.sampleScreenState === "sample-awaiting-payment" &&
    DATA.payments.some(
      (payment) =>
        payment.orderNo === order.header.no &&
        payment.status === "expected" &&
        payment.paymentType === "deposit",
    ),
);
/** A short order whose SPR the product manager has still to raise. */
const SHORT = DATA.orders.find(
  (order) =>
    order.sampleScreenState === "sample-short-stock" &&
    DATA.sprs.some(
      (spr) => spr.orderNo === order.header.no && spr.status === "suggested",
    ),
);

describe("the payment thread (#290): Finance's confirmation reaches the warehouse", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  let next = 0;

  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`No session for ${role}`);
    return browser;
  };
  /** A fresh order for each test, so one test never meets another's moves. */
  const awaiting = () => {
    const entry = AWAITING[next];
    next += 1;
    if (!entry) throw new Error("The dataset has too few orders to pay");
    return entry;
  };
  const tasksOf = async (role: Role): Promise<WorkflowTask[]> => {
    const res = await call(t, as(role), "get", `${W}/tasks?pageSize=200`);
    expect(res.status).toBe(200);
    return (res.body as { data: WorkflowTask[] }).data;
  };
  const taskFor = async (role: Role, orderNo: string, kind: string) =>
    (await tasksOf(role)).find(
      (task) => task.orderNo === orderNo && task.kind === kind,
    );
  const pay = (
    orderNo: string,
    amount: string,
    role: Role = "FINANCE",
    extra: {
      reference?: string;
      currencyCode?: string;
      paymentType?: string;
    } = {},
  ) =>
    call(t, as(role), "post", `${W}/orders/${orderNo}/payments`, {
      csrf: true,
      body: {
        paymentType: extra.paymentType ?? "prepayment",
        amount,
        currencyCode: extra.currencyCode ?? "USD",
        reference: extra.reference ?? `TT-${orderNo}-${amount}`,
        paidOn: DATA.asOf,
      },
    });
  const refusals = () => auditCount(t, "workflows.payment.refused");
  const paymentIdOf = (res: { body: unknown }) =>
    paymentResponseSchema.parse(res.body).data.paymentId;
  const undoPay = (orderNo: string, paymentId: string) =>
    call(
      t,
      as("FINANCE"),
      "post",
      `${W}/orders/${orderNo}/payments/${paymentId}/undo`,
      { csrf: true },
    );
  const act = (role: Role, taskId: string, action: "complete" | "undo") =>
    call(t, as(role), "post", `${W}/tasks/${taskId}/${action}`, {
      csrf: true,
    });
  const flowOf = async (orderNo: string) => {
    const res = await call(
      t,
      as("FINANCE"),
      "get",
      `${W}/orders/${orderNo}/flow`,
    );
    expect(res.status).toBe(200);
    return orderFlowResponseSchema.parse(res.body).data;
  };
  const currentOf = async (orderNo: string) =>
    (await flowOf(orderNo)).steps.find((step) => step.state === "current");
  const statusOf = async (orderNo: string) =>
    (await t.app.get(OrderWorkflowService).statusOf(orderNo))?.status;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });

  it("starts a prepayment order at the payment, with Finance named on its flow; a deposit-only order stays a sample", async () => {
    const { orderNo } = awaiting();
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
    expect(await currentOf(orderNo)).toMatchObject({
      key: "payment-confirmed",
      ownerRole: "FINANCE",
    });
    expect(await taskFor("FINANCE", orderNo, "CONFIRM_PAYMENT")).toBeDefined();
    if (!DEPOSIT_ONLY) throw new Error("No deposit-only order in the dataset");
    expect(await statusOf(DEPOSIT_ONLY.header.no)).toBeUndefined();
  });

  it("moves the order on and gives the warehouse its Pack task once the prepayment is in", async () => {
    const { orderNo, amount } = awaiting();

    const res = await pay(orderNo, amount);

    expect(res.status).toBe(200);
    expect(await statusOf(orderNo)).toBe("Paid");
    expect(
      await taskFor("FINANCE", orderNo, "CONFIRM_PAYMENT"),
    ).toBeUndefined();
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toMatchObject({
      assigneeRole: "WAREHOUSE",
      title: "Pick and pack the order",
      overdue: false,
    });
    const flow = await flowOf(orderNo);
    expect(flow.steps.find((step) => step.state === "current")).toMatchObject({
      key: "packed",
      ownerRole: "WAREHOUSE",
    });
    expect(flow.payment.amountDue).toBeNull();
    expect(flow.payment.confirmations).toContainEqual(
      expect.objectContaining({ id: paymentIdOf(res), amount }),
    );
  });

  it("keeps the order waiting until unequal payments together cover the prepayment, showing what is left", async () => {
    const { orderNo, amount } = awaiting();
    const first = (Number(amount) * 0.4).toFixed(2);
    const rest = (Number(amount) - Number(first)).toFixed(2);

    expect((await pay(orderNo, first)).status).toBe(200);
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toBeUndefined();
    expect((await flowOf(orderNo)).payment.amountDue).toBe(rest);

    expect((await pay(orderNo, rest)).status).toBe(200);
    expect(await statusOf(orderNo)).toBe("Paid");
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toBeDefined();
  });

  it("takes two equal instalments under different bank references as two payments", async () => {
    const { orderNo, amount } = awaiting();
    const part = (Math.floor((Number(amount) * 100) / 3) / 100).toFixed(2);
    const last = (Number(amount) - 2 * Number(part)).toFixed(2);

    expect(
      (await pay(orderNo, part, "FINANCE", { reference: "TT-A" })).status,
    ).toBe(200);
    expect(
      (await pay(orderNo, part, "FINANCE", { reference: "TT-B" })).status,
    ).toBe(200);
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
    expect(
      (await pay(orderNo, last, "FINANCE", { reference: "TT-C" })).status,
    ).toBe(200);
    expect(await statusOf(orderNo)).toBe("Paid");
  });

  it("refuses the same transfer twice, by its bank reference, and audits the refusal", async () => {
    const { orderNo, amount } = awaiting();
    const half = (Number(amount) / 2).toFixed(2);
    expect(
      (await pay(orderNo, half, "FINANCE", { reference: "TT-SAME" })).status,
    ).toBe(200);
    const refused = await refusals();

    const again = await pay(orderNo, "10.00", "FINANCE", {
      reference: "tt-same ",
    });

    expect(again.status).toBe(409);
    expect(await refusals()).toBe(refused + 1);
  });

  it("refuses the right amount in the wrong currency, leaves the order waiting, and audits it", async () => {
    const { orderNo, amount } = awaiting();
    const refused = await refusals();

    const res = await pay(orderNo, amount, "FINANCE", { currencyCode: "INR" });

    expect(res.status).toBe(409);
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toBeUndefined();
    expect(await refusals()).toBe(refused + 1);
  });

  it("keeps a deposit on a running order without opening the gate, and takes it back", async () => {
    const { orderNo, amount } = awaiting();
    const res = await pay(orderNo, amount, "FINANCE", {
      paymentType: "deposit",
    });
    expect(res.status).toBe(200);
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toBeUndefined();

    expect((await undoPay(orderNo, paymentIdOf(res))).status).toBe(200);
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
  });

  it("takes back a payment kept before the order reached the gate", async () => {
    if (!SHORT) throw new Error("No short order in the dataset");
    const orderNo = SHORT.header.no;
    const res = await pay(orderNo, "999999.00", "FINANCE", {
      paymentType: "full-payment",
    });
    expect(res.status).toBe(200);
    expect(await statusOf(orderNo)).toBe("StockChecked");

    expect((await undoPay(orderNo, paymentIdOf(res))).status).toBe(200);
    expect(await statusOf(orderNo)).toBe("StockChecked");
  });

  it("answers 401 with no session, 400 for a bad body and 404, audited, for an unknown payment", async () => {
    const { orderNo } = awaiting();
    const body = {
      paymentType: "prepayment",
      currencyCode: "USD",
      reference: "X",
      paidOn: DATA.asOf,
    };
    const signedOut = await call(
      t,
      null,
      "post",
      `${W}/orders/${orderNo}/payments`,
      {
        body: { ...body, amount: "1.00" },
      },
    );
    expect(signedOut.status).toBe(401);

    const bad = await call(
      t,
      as("FINANCE"),
      "post",
      `${W}/orders/${orderNo}/payments`,
      {
        csrf: true,
        body: { ...body, amount: "-5" },
      },
    );
    expect(bad.status).toBe(400);

    const refused = await refusals();
    const unknown = await undoPay(
      orderNo,
      "99999999-9999-4999-8999-999999999999",
    );
    expect(unknown.status).toBe(404);
    expect(await refusals()).toBe(refused + 1);
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
  });

  it("says a running order's flow is not mock, and a sample's is", async () => {
    const { orderNo } = awaiting();
    const flowMeta = async (no: string) =>
      (await call(t, as("FINANCE"), "get", `${W}/orders/${no}/flow`)).body as {
        meta: { mock: boolean };
      };
    expect((await flowMeta(orderNo)).meta.mock).toBe(false);
    if (!DEPOSIT_ONLY) throw new Error("No deposit-only order in the dataset");
    expect((await flowMeta(DEPOSIT_ONLY.header.no)).meta.mock).toBe(true);
  });

  it("takes the warehouse's task away when Finance undoes the payment, and gives Finance its task back", async () => {
    const { orderNo, amount } = awaiting();
    const paymentId = paymentIdOf(await pay(orderNo, amount));

    const res = await undoPay(orderNo, paymentId);

    expect(res.status).toBe(200);
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toBeUndefined();
    // Stored as done, not only out of sight: a later payment must open it afresh.
    expect(
      await t.app.get(WorkflowTaskRepository).openOf(orderNo, "PACK_ORDER"),
    ).toBeNull();
    expect(await taskFor("FINANCE", orderNo, "CONFIRM_PAYMENT")).toBeDefined();
    expect((await flowOf(orderNo)).payment.confirmations).not.toContainEqual(
      expect.objectContaining({ id: paymentId }),
    );
  });

  it("moves the order to Support's invoice when the warehouse packs it, and keeps the payment once packing has started", async () => {
    const { orderNo, amount } = awaiting();
    const paymentId = paymentIdOf(await pay(orderNo, amount));
    const packing = await taskFor("WAREHOUSE", orderNo, "PACK_ORDER");
    if (!packing) throw new Error("No Pack task");

    expect((await act("WAREHOUSE", packing.id, "complete")).status).toBe(200);

    expect(await statusOf(orderNo)).toBe("Packing");
    expect(await currentOf(orderNo)).toMatchObject({
      key: "invoiced",
      ownerRole: "SUPPORT",
    });
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toBeUndefined();
    // The goods are being packed against that money, so it cannot be taken back.
    const refused = await refusals();
    expect((await undoPay(orderNo, paymentId)).status).toBe(409);
    expect(await statusOf(orderNo)).toBe("Packing");
    expect(await refusals()).toBe(refused + 1);

    expect((await act("WAREHOUSE", packing.id, "undo")).status).toBe(200);
    expect(await statusOf(orderNo)).toBe("Paid");
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toBeDefined();
  });

  it("refuses a payment from a role that cannot confirm one, and packing from another role", async () => {
    const { orderNo, amount } = awaiting();
    expect((await pay(orderNo, amount, "WAREHOUSE")).status).toBe(403);
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");

    await pay(orderNo, amount);
    const packing = await taskFor("WAREHOUSE", orderNo, "PACK_ORDER");
    if (!packing) throw new Error("No Pack task");
    expect((await act("FINANCE", packing.id, "complete")).status).toBe(403);
    expect(await statusOf(orderNo)).toBe("Paid");
  });

  it("names the product manager on a short order's flow, as its open Raise task does", async () => {
    if (!SHORT) throw new Error("No short order in the dataset");
    expect(await currentOf(SHORT.header.no)).toMatchObject({
      key: "spr-approval",
      ownerRole: "PRODUCT_MANAGER",
    });
    expect(
      await taskFor("PRODUCT_MANAGER", SHORT.header.no, "RAISE_SPR"),
    ).toBeDefined();
  });
});
