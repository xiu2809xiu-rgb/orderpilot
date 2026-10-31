import {
  INBOX_ROLES,
  NOT_APPLIED_MESSAGE,
  ROLES,
  errorEnvelopeSchema,
  type Role,
} from "@orderpilot/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RecordNumberService } from "../../src/modules/workflows/record-number.service.js";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";
import {
  orderFlowResponseSchema,
  reminderListResponseSchema,
  sprDecisionResponseSchema,
  sprResponseSchema,
  taskListResponseSchema,
  documentConfigResponseSchema,
  paymentResponseSchema,
} from "../../src/modules/workflows/workflows.schemas.js";

const W = `${API}/workflows`;
const SPR = "SPR-20261102-0001";

describe("the area 2 routes", () => {
  let t: TestApp;
  const sessions = new Map<Role, Browser>();
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

  describe("task inboxes", () => {
    it("gives each role with an inbox its own tasks, marked as mock", async () => {
      for (const role of INBOX_ROLES) {
        const res = await call(t, as(role), "get", `${W}/tasks`);
        expect(res.status, role).toBe(200);
        const body = taskListResponseSchema.parse(res.body);
        expect(body.meta.mock).toBe(true);
        expect(body.data.length).toBeGreaterThan(0);
        expect(body.data.every((task) => task.assigneeRole === role)).toBe(
          true,
        );
      }
    });

    it("refuses a role with no inbox, and a signed-out caller", async () => {
      const admin = await call(t, as("SYSTEM_ADMIN"), "get", `${W}/tasks`);
      expect(admin.status).toBe(403);
      const noInbox = await call(t, as("MANAGEMENT"), "get", `${W}/tasks`);
      expect(noInbox.status).toBe(403);
      expect((await call(t, null, "get", `${W}/tasks`)).status).toBe(401);
    });

    it("lets only the roles that oversee open another role's inbox", async () => {
      const path = `${W}/inboxes/WAREHOUSE/tasks`;
      const management = await call(t, as("MANAGEMENT"), "get", path);
      expect(management.status).toBe(200);
      expect(
        taskListResponseSchema
          .parse(management.body)
          .data.every((task) => task.assigneeRole === "WAREHOUSE"),
      ).toBe(true);
      expect((await call(t, as("AUDITOR"), "get", path)).status).toBe(200);
      // The warehouse may not read the finance inbox, by the route or the permission.
      expect(
        (await call(t, as("WAREHOUSE"), "get", `${W}/inboxes/FINANCE/tasks`))
          .status,
      ).toBe(403);
    });

    it("rejects a role that has no inbox in the path, and a bad page size", async () => {
      const bad = await call(
        t,
        as("MANAGEMENT"),
        "get",
        `${W}/inboxes/AUDITOR/tasks`,
      );
      expect(bad.status).toBe(400);
      expect(errorEnvelopeSchema.parse(bad.body).error.code).toBe(
        "VALIDATION_FAILED",
      );
      expect(
        (await call(t, as("SUPPORT"), "get", `${W}/tasks?pageSize=0`)).status,
      ).toBe(400);
    });

    it("keeps only overdue tasks when asked", async () => {
      const res = await call(
        t,
        as("LOGISTICS"),
        "get",
        `${W}/tasks?overdue=true`,
      );
      const { data } = taskListResponseSchema.parse(res.body);
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((task) => task.overdue)).toBe(true);
    });
  });

  describe("an order's steps and timeline", () => {
    it("returns the steps, the timeline and the payment, as mock", async () => {
      const res = await call(
        t,
        as("FINANCE"),
        "get",
        `${W}/orders/SO-0004/flow`,
      );
      expect(res.status).toBe(200);
      const body = orderFlowResponseSchema.parse(res.body);
      expect(body.meta.mock).toBe(true);
      expect(body.data.payment.prepaymentPercent).toBe("50");
      expect(body.data.steps.some((step) => step.state === "current")).toBe(
        true,
      );
    });

    it("answers 404 for an order that is not in the data", async () => {
      const res = await call(
        t,
        as("FINANCE"),
        "get",
        `${W}/orders/SO-9999/flow`,
      );
      expect(res.status).toBe(404);
    });
  });

  describe("the SPR approval page", () => {
    it("returns the SPR with its suggested fields and the approver's setup", async () => {
      const res = await call(t, as("APPROVER"), "get", `${W}/sprs/${SPR}`);
      expect(res.status).toBe(200);
      const body = sprResponseSchema.parse(res.body);
      expect(body.data.ref).toEqual({ recordNo: SPR, navisionNo: null });
      expect(body.data.fields.some((f) => f.origin === "suggested")).toBe(true);
      expect(body.data.approver.setup.purchaseAmountApprovalLimit).toBe(
        "5000.00",
      );
    });

    it("lets the approver approve or reject with a comment, and changes nothing", async () => {
      for (const action of ["approve", "reject"] as const) {
        const res = await call(
          t,
          as("APPROVER"),
          "post",
          `${W}/sprs/${SPR}/${action}`,
          { csrf: true, body: { comment: "Checked against the quote." } },
        );
        expect(res.status, action).toBe(200);
        const body = sprDecisionResponseSchema.parse(res.body);
        expect(body.data.applied).toBe(false);
        expect(body.data.message).toBe(NOT_APPLIED_MESSAGE);
      }
      const after = await call(t, as("APPROVER"), "get", `${W}/sprs/${SPR}`);
      expect(sprResponseSchema.parse(after.body).data.decision).toBeNull();
    });

    it("needs a comment", async () => {
      const res = await call(
        t,
        as("APPROVER"),
        "post",
        `${W}/sprs/${SPR}/approve`,
        { csrf: true, body: { comment: "   " } },
      );
      expect(res.status).toBe(400);
    });

    it("refuses a role that cannot decide, and a request without the CSRF header", async () => {
      const body = { comment: "Looks fine." };
      const pm = await call(
        t,
        as("PRODUCT_MANAGER"),
        "post",
        `${W}/sprs/${SPR}/approve`,
        { csrf: true, body },
      );
      expect(pm.status).toBe(403);
      const noCsrf = await call(
        t,
        as("APPROVER"),
        "post",
        `${W}/sprs/${SPR}/approve`,
        { body },
      );
      expect(noCsrf.status).toBe(403);
    });
  });

  describe("payments", () => {
    const body = {
      paymentType: "prepayment",
      amount: "1000.00",
      currencyCode: "USD",
      reference: "TT-0004",
      paidOn: "2026-11-02",
    };

    it("takes a payment type, checks it and stores nothing", async () => {
      const res = await call(
        t,
        as("FINANCE"),
        "post",
        `${W}/orders/SO-0004/payments`,
        { csrf: true, body },
      );
      expect(res.status).toBe(200);
      expect(paymentResponseSchema.parse(res.body).data.applied).toBe(false);
    });

    it("refuses an unknown payment type and a role that cannot confirm", async () => {
      const unknown = await call(
        t,
        as("FINANCE"),
        "post",
        `${W}/orders/SO-0004/payments`,
        { csrf: true, body: { ...body, paymentType: "GIFT" } },
      );
      expect(unknown.status).toBe(400);
      const support = await call(
        t,
        as("SUPPORT"),
        "post",
        `${W}/orders/SO-0004/payments`,
        { csrf: true, body },
      );
      expect(support.status).toBe(403);
    });
  });

  describe("reminders and configuration", () => {
    it("lists a role's reminders, as mock", async () => {
      const res = await call(t, as("LOGISTICS"), "get", `${W}/reminders`);
      const body = reminderListResponseSchema.parse(res.body);
      expect(body.meta.mock).toBe(true);
      expect(body.data.every((r) => r.toRole === "LOGISTICS")).toBe(true);
    });

    it("reads the document settings from the table, not from code", async () => {
      const res = await call(t, as("SUPPORT"), "get", `${W}/document-config`);
      const { data } = documentConfigResponseSchema.parse(res.body);
      expect(data.map((entry) => entry.documentType)).toContain("SPR");
      const spr = data.find((entry) => entry.documentType === "SPR");
      expect(
        spr?.fields.find((field) => field.key === "deliveryTerms")
          ?.defaultValue,
      ).toBe("FOB");
    });
  });

  describe("record numbers", () => {
    it("hands out distinct numbers to requests that arrive together", async () => {
      const service = t.app.get(RecordNumberService);
      const at = new Date("2027-01-15T02:00:00Z");
      const numbers = await Promise.all(
        Array.from({ length: 12 }, () => service.next("SPR", at)),
      );
      expect(new Set(numbers).size).toBe(12);
      expect(numbers.every((n) => n.startsWith("SPR-20270115-"))).toBe(true);
      expect([...numbers].sort()[0]).toBe("SPR-20270115-0001");
    });
  });
});
