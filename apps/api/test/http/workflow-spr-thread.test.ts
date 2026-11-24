import {
  ROLES,
  TASK_RECORDED_MESSAGE,
  TASK_UNDONE_MESSAGE,
  type Role,
  type WorkflowTask,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrderWorkflowService } from "../../src/modules/workflows/order-workflow.service.js";
import { WorkflowTaskRepository } from "../../src/modules/workflows/workflow-task.repository.js";
import { sprResponseSchema } from "../../src/modules/workflows/workflows.schemas.js";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

const W = `${API}/workflows`;
const DATA = syntheticDataset();

/** The SPRs the product manager has still to raise, each with its Raise task. */
const TO_RAISE = DATA.sprs.flatMap((spr) => {
  const order = DATA.orders.find((o) => o.header.no === spr.orderNo);
  const task = DATA.tasks.find(
    (entry) => entry.kind === "RAISE_SPR" && entry.orderNo === spr.orderNo,
  );
  return spr.status === "suggested" &&
    order?.sampleScreenState === "sample-short-stock" &&
    task
    ? [{ spr, taskId: task.id }]
    : [];
});

describe("the SPR thread (#251, #290): raised, sent to the approvers, decided and handed back", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
  let next = 0;

  const as = (role: Role): Browser => {
    const browser = sessions.get(role);
    if (!browser) throw new Error(`No session for ${role}`);
    return browser;
  };
  /** A fresh SPR to raise for each test, so one test never meets another's moves. */
  const toRaise = () => {
    const entry = TO_RAISE[next];
    next += 1;
    if (!entry) throw new Error("The dataset has too few SPRs to raise");
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
  const decide = (recordNo: string, action: "approve" | "reject") =>
    call(t, as("APPROVER"), "post", `${W}/sprs/${recordNo}/${action}`, {
      csrf: true,
      body: { comment: "Under a month of cover." },
    });
  const sprPage = async (recordNo: string) => {
    const res = await call(
      t,
      as("PRODUCT_MANAGER"),
      "get",
      `${W}/sprs/${recordNo}`,
    );
    expect(res.status).toBe(200);
    return sprResponseSchema.parse(res.body).data;
  };
  const statusOf = async (orderNo: string) =>
    (await t.app.get(OrderWorkflowService).statusOf(orderNo))?.status;

  beforeAll(async () => {
    await resetTestData();
    // Area 2 routes SPRs with the approver group (ADR 0056, #251).
    t = await createTestApp({ APPROVER_GROUP: "on" });
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
  });
  afterAll(async () => {
    await t.close();
  });

  it("starts a short order at the stock check, with the SPR a suggestion the product manager can raise", async () => {
    const { spr, taskId } = toRaise();
    expect(await statusOf(spr.orderNo)).toBe("StockChecked");
    expect(
      await taskFor("PRODUCT_MANAGER", spr.orderNo, "RAISE_SPR"),
    ).toBeDefined();
    const page = await sprPage(spr.recordNo);
    expect(page.stage).toBe("suggested");
    expect(page.raiseTaskId).toBe(taskId);
    expect(page.decidable).toBe(false);
  });

  it("sends a raised SPR to the approvers, with what it buys and its amount", async () => {
    const { spr, taskId } = toRaise();

    const res = await act("PRODUCT_MANAGER", taskId, "complete");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { applied: true, message: TASK_RECORDED_MESSAGE, status: "DONE" },
    });
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    expect(
      await taskFor("PRODUCT_MANAGER", spr.orderNo, "RAISE_SPR"),
    ).toBeUndefined();
    const approval = await taskFor("APPROVER", spr.orderNo, "APPROVE_SPR");
    expect(approval).toMatchObject({
      assigneeRole: "APPROVER",
      ref: { recordNo: spr.recordNo },
      amount: spr.amount,
      spr: { quantity: spr.quantity },
      overdue: false,
    });
    const page = await sprPage(spr.recordNo);
    expect(page.stage).toBe("with-approvers");
    expect(page.decidable).toBe(true);
    expect(page.due?.overdue).toBe(false);
  });

  it("hands an approved SPR back to the product manager to place the vendor PO, and refuses a second decision", async () => {
    const { spr, taskId } = toRaise();
    await act("PRODUCT_MANAGER", taskId, "complete");

    expect((await decide(spr.recordNo, "approve")).status).toBe(200);

    expect(await statusOf(spr.orderNo)).toBe("SprApproved");
    expect(
      await taskFor("APPROVER", spr.orderNo, "APPROVE_SPR"),
    ).toBeUndefined();
    const placing = await taskFor(
      "PRODUCT_MANAGER",
      spr.orderNo,
      "PLACE_VENDOR_PO",
    );
    expect(placing).toMatchObject({
      title: "Place the vendor PO",
      ref: { recordNo: spr.recordNo },
    });
    expect((await sprPage(spr.recordNo)).stage).toBe("decided");
    // The first decision closes the SPR.
    expect((await decide(spr.recordNo, "reject")).status).toBe(409);

    if (!placing) throw new Error("No task to place the vendor PO");
    expect((await act("PRODUCT_MANAGER", placing.id, "complete")).status).toBe(
      200,
    );
    expect(
      await taskFor("PRODUCT_MANAGER", spr.orderNo, "PLACE_VENDOR_PO"),
    ).toBeUndefined();
    expect((await act("PRODUCT_MANAGER", placing.id, "undo")).status).toBe(200);
    expect(
      await taskFor("PRODUCT_MANAGER", spr.orderNo, "PLACE_VENDOR_PO"),
    ).toBeDefined();
  });

  it("takes the hand-back away when the decision is undone, and gives the SPR back to the approvers", async () => {
    const { spr, taskId } = toRaise();
    await act("PRODUCT_MANAGER", taskId, "complete");
    await decide(spr.recordNo, "approve");

    const res = await call(
      t,
      as("APPROVER"),
      "post",
      `${W}/sprs/${spr.recordNo}/undo`,
      {
        csrf: true,
      },
    );

    expect(res.status).toBe(200);
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    expect(
      await taskFor("PRODUCT_MANAGER", spr.orderNo, "PLACE_VENDOR_PO"),
    ).toBeUndefined();
    // Stored as done, not only out of sight: a later approval must open it afresh.
    expect(
      await t.app
        .get(WorkflowTaskRepository)
        .openOf(spr.orderNo, "PLACE_VENDOR_PO"),
    ).toBeNull();
    expect(await taskFor("APPROVER", spr.orderNo, "APPROVE_SPR")).toBeDefined();
  });

  it("sends a rejected SPR back to the product manager, who can correct it and raise it again", async () => {
    const { spr, taskId } = toRaise();
    await act("PRODUCT_MANAGER", taskId, "complete");

    expect((await decide(spr.recordNo, "reject")).status).toBe(200);

    expect(await statusOf(spr.orderNo)).toBe("StockChecked");
    const again = await taskFor("PRODUCT_MANAGER", spr.orderNo, "RAISE_SPR");
    expect(again).toBeDefined();
    if (!again) throw new Error("No task to raise it again");
    // The SPR page offers the same raise, beside the rejection.
    const rejected = await sprPage(spr.recordNo);
    expect(rejected.stage).toBe("decided");
    expect(rejected.raiseTaskId).toBe(again.id);
    expect((await act("PRODUCT_MANAGER", again.id, "complete")).status).toBe(
      200,
    );
    expect(await statusOf(spr.orderNo)).toBe("AwaitingSpr");
    expect(await taskFor("APPROVER", spr.orderNo, "APPROVE_SPR")).toBeDefined();
  });

  it("takes a raise back before anyone has decided it", async () => {
    const { spr, taskId } = toRaise();
    await act("PRODUCT_MANAGER", taskId, "complete");

    const res = await act("PRODUCT_MANAGER", taskId, "undo");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      data: { message: TASK_UNDONE_MESSAGE, status: "OPEN" },
    });
    expect(await statusOf(spr.orderNo)).toBe("StockChecked");
    expect(
      await taskFor("APPROVER", spr.orderNo, "APPROVE_SPR"),
    ).toBeUndefined();
    expect(
      await taskFor("PRODUCT_MANAGER", spr.orderNo, "RAISE_SPR"),
    ).toBeDefined();
    expect((await sprPage(spr.recordNo)).stage).toBe("suggested");
  });

  it("refuses a raise from another role, and a raise twice", async () => {
    const { spr, taskId } = toRaise();

    expect((await act("SUPPORT", taskId, "complete")).status).toBe(403);
    expect(await statusOf(spr.orderNo)).toBe("StockChecked");

    expect((await act("PRODUCT_MANAGER", taskId, "complete")).status).toBe(200);
    expect((await act("PRODUCT_MANAGER", taskId, "complete")).status).toBe(404);
  });
});
