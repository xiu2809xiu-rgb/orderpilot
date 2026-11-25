import { ROLES, type Role, type WorkflowTask } from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Database } from "../../src/database/database.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import { WorkflowTaskRepository } from "../../src/modules/workflows/workflow-task.repository.js";
import {
  orderFlowResponseSchema,
  piReissueResponseSchema,
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

/** The orders whose PI Support has still to send, with no prepayment due and enough stock. */
const TO_SEND = DATA.orders.flatMap((order) => {
  const task = DATA.tasks.find(
    (entry) => entry.kind === "SEND_PI" && entry.orderNo === order.header.no,
  );
  return order.sampleScreenState === "sample-pi-to-send" &&
    order.stockShortfall === null &&
    Number(order.header.prepaymentPercent) === 0 &&
    task
    ? [{ orderNo: order.header.no, taskId: task.id }]
    : [];
});

describe("the PI thread (#251, point 6): sent, taken back, reversed and reissued", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  let next = 0;

  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`No session for ${role}`);
    return browser;
  };
  /**
   * An order whose PI waits to be sent, put back to where the seed left it, so
   * each test starts clean though only a few sample orders qualify.
   */
  const toSend = async () => {
    const entry = TO_SEND[next % TO_SEND.length];
    next += 1;
    if (!entry) throw new Error("The dataset has no PI to send");
    const database = t.app.get(Database);
    const where = { instance: { orderRef: entry.orderNo } };
    await database.client.workflowInstance.updateMany({
      where: { orderRef: entry.orderNo },
      data: { status: "StockChecked", currentStep: "pi-sent" },
    });
    await database.client.workflowRecord.updateMany({
      where: { recordType: "PI", ...where },
      data: { data: Prisma.DbNull },
    });
    await database.client.paymentConfirmation.deleteMany({
      where: { orderRef: entry.orderNo },
    });
    await database.client.workflowTask.updateMany({
      where: { kind: "SEND_PI", ...where },
      data: { status: "OPEN", completedAt: null },
    });
    await database.client.workflowTask.updateMany({
      where: { kind: { in: ["PACK_ORDER", "CONFIRM_PAYMENT"] }, ...where },
      data: { status: "DONE" },
    });
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
  const act = (role: Role, taskId: string, action: "complete" | "undo") =>
    call(t, as(role), "post", `${W}/tasks/${taskId}/${action}`, {
      csrf: true,
    });
  const reissue = (orderNo: string, reason: string, role: Role = "SUPPORT") =>
    call(t, as(role), "post", `${W}/orders/${orderNo}/pi/reissue`, {
      csrf: true,
      body: { reason },
    });
  const flowOf = async (orderNo: string) => {
    const res = await call(
      t,
      as("SUPPORT"),
      "get",
      `${W}/orders/${orderNo}/flow`,
    );
    expect(res.status).toBe(200);
    return orderFlowResponseSchema.parse(res.body).data;
  };
  const statusOf = async (orderNo: string) =>
    (await t.app.get(OrderWorkflowService).statusOf(orderNo))?.status;
  const refusals = () => auditCount(t, "workflows.pi.refused");

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });

  it("starts the order at the stock check, with Support's Send the PI and no PI sent", async () => {
    const { orderNo } = await toSend();
    expect(await statusOf(orderNo)).toBe("StockChecked");
    expect(await taskFor("SUPPORT", orderNo, "SEND_PI")).toBeDefined();
    const flow = await flowOf(orderNo);
    expect(flow.pi).toBeNull();
    expect(flow.steps.find((step) => step.state === "current")).toMatchObject({
      key: "pi-sent",
      ownerRole: "SUPPORT",
    });
  });

  it("moves the order on when Support sends the PI, and gives the warehouse its task when no prepayment is due", async () => {
    const { orderNo, taskId } = await toSend();

    expect((await act("SUPPORT", taskId, "complete")).status).toBe(200);

    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
    expect(await taskFor("SUPPORT", orderNo, "SEND_PI")).toBeUndefined();
    expect(await taskFor("WAREHOUSE", orderNo, "PACK_ORDER")).toBeDefined();
    const flow = await flowOf(orderNo);
    expect(flow.pi).toMatchObject({
      issue: 1,
      reversals: [],
      reissuable: true,
    });
    expect(flow.steps.find((step) => step.state === "current")).toMatchObject({
      key: "packed",
      ownerRole: "WAREHOUSE",
    });
  });

  it("takes back a send made by mistake, while nothing has followed", async () => {
    const { orderNo, taskId } = await toSend();
    await act("SUPPORT", taskId, "complete");

    expect((await act("SUPPORT", taskId, "undo")).status).toBe(200);

    expect(await statusOf(orderNo)).toBe("StockChecked");
    expect(await taskFor("SUPPORT", orderNo, "SEND_PI")).toBeDefined();
    expect(
      await t.app.get(WorkflowTaskRepository).openOf(orderNo, "PACK_ORDER"),
    ).toBeNull();
    expect((await flowOf(orderNo)).pi).toBeNull();
  });

  it("reverses and reissues a PI that went out, keeping every reason, and audits each", async () => {
    const { orderNo, taskId } = await toSend();
    await act("SUPPORT", taskId, "complete");
    const audited = await auditCount(t, "workflows.pi.reissued");

    const first = await reissue(orderNo, "Wrong shipping terms");
    expect(first.status).toBe(200);
    expect(piReissueResponseSchema.parse(first.body).data.issue).toBe(2);
    expect(
      (await reissue(orderNo, "Customer's PO number missing")).status,
    ).toBe(200);

    const pi = (await flowOf(orderNo)).pi;
    expect(pi).toMatchObject({ issue: 3, reissuable: true });
    expect(pi?.reversals.map((r) => [r.issue, r.reason])).toEqual([
      [1, "Wrong shipping terms"],
      [2, "Customer's PO number missing"],
    ]);
    expect(await auditCount(t, "workflows.pi.reissued")).toBe(audited + 2);
    // The order waits on the same step: a reissue does not move it.
    expect(await statusOf(orderNo)).toBe("AwaitingPayment");
    // Reissued, it was really sent: the mistaken-send undo no longer applies.
    expect((await act("SUPPORT", taskId, "undo")).status).toBe(409);
  });

  it("refuses a reissue without a reason, from a role that cannot edit orders, and before the PI is sent", async () => {
    const { orderNo, taskId } = await toSend();
    const refused = await refusals();

    expect((await reissue(orderNo, "Not sent yet")).status).toBe(404);
    expect(await refusals()).toBe(refused + 1);

    await act("SUPPORT", taskId, "complete");
    expect((await reissue(orderNo, "   ")).status).toBe(400);
    expect((await reissue(orderNo, "Wrong terms", "WAREHOUSE")).status).toBe(
      403,
    );
    expect((await flowOf(orderNo)).pi?.issue).toBe(1);
  });

  it("refuses a reissue and an undo once a payment is kept or the goods are packed, and audits it", async () => {
    const { orderNo, taskId } = await toSend();
    await act("SUPPORT", taskId, "complete");
    const paid = await call(
      t,
      as("FINANCE"),
      "post",
      `${W}/orders/${orderNo}/payments`,
      {
        csrf: true,
        body: {
          paymentType: "deposit",
          amount: "100.00",
          currencyCode: "USD",
          reference: `PI-TEST-${orderNo}`,
          paidOn: DATA.asOf,
        },
      },
    );
    expect(paid.status).toBe(200);
    const refused = await refusals();

    expect((await reissue(orderNo, "Wrong terms")).status).toBe(409);
    expect((await act("SUPPORT", taskId, "undo")).status).toBe(409);
    expect(await refusals()).toBe(refused + 2);
    expect((await flowOf(orderNo)).pi).toMatchObject({
      issue: 1,
      reissuable: false,
    });
  });
});
