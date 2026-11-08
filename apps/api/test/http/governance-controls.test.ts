import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import {
  DEFAULT_ROLE_PERMISSIONS,
  ROLES,
  decimalStringSchema,
  errorEnvelopeSchema,
  sessionResponseSchema,
  type Role,
} from "@orderpilot/shared";
import type { Request } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { AuthContext } from "../../src/auth/auth-context.js";
import {
  Auth,
  Authenticated,
  RequirePermission,
} from "../../src/auth/decorators.js";
import { PasswordHasher } from "../../src/auth/domain/password-hasher.js";
import { PermissionPolicy } from "../../src/auth/permission-policy.js";
import { requestIdOf } from "../../src/common/request-id.js";
import { ZodValidationPipe } from "../../src/common/zod-validation.pipe.js";
import { Database } from "../../src/database/database.js";
import { seedApprovalSetups } from "../../src/modules/governance/approval-setup-seed.js";
import { ApprovalSetupRepository } from "../../src/modules/governance/approval-setup.repository.js";
import { ApprovalSetupService } from "../../src/modules/governance/approval-setup.service.js";
import { AuthorisationService } from "../../src/modules/governance/authorisation.service.js";
import type { ApprovalSetup } from "../../src/modules/governance/domain/approval-setup.js";
import { GovernancePermissionPolicy } from "../../src/modules/governance/governance-permission-policy.js";
import { UserRepository } from "../../src/users/user.repository.js";
import {
  API,
  TEST_DEMO_PASSWORD,
  auditEvents,
  browserFrom,
  call,
  demoSignIn,
  emailForRole,
  type Browser,
} from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

// Area 4's to-do tests (F-1). Each name is a case the real policy must pass.
// Angelyn turns them into tests as F-3, F-4 and F-5 land; nothing here is
// skipped or silenced, and `pnpm test` lists them as todo.

const standInBodySchema = z.object({
  action: z.string().min(1),
  amount: decimalStringSchema.optional(),
  requesterUserId: z.uuid().optional(),
});
type StandInBody = z.infer<typeof standInBodySchema>;

/**
 * Stands in for area 2's SPR approval until C-3 calls the policy, and does what
 * an acting route will do: the guard checks the permission, then the route
 * asks the policy before it acts. It is registered only in this file's test
 * app, through createTestApp's extra controllers, never in production code.
 */
@Controller("test-only/approvals")
class StandInApprovalController {
  constructor(@Inject(ModuleRef) private readonly modules: ModuleRef) {}

  @Post(":recordNo/approve")
  @HttpCode(200)
  @RequirePermission("approvals.decide")
  async approve(
    @Param("recordNo") recordNo: string,
    @Body(new ZodValidationPipe(standInBodySchema)) body: StandInBody,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    // The test app's root module cannot inject GovernanceModule's providers,
    // so the service is looked up across modules.
    const policy = this.modules.get(AuthorisationService, { strict: false });
    await policy.enforce(
      {
        actor: { userId: auth.user.id, role: auth.user.role },
        action: body.action,
        resource: { type: "Spr", id: recordNo },
        amount: body.amount,
        requesterUserId: body.requesterUserId,
      },
      { ip: req.ip ?? null, traceId: requestIdOf(req) },
    );
    return { data: { approved: recordNo } };
  }
}

const standInActionSchema = z.object({
  action: z.string().min(1),
  requesterUserId: z.uuid().optional(),
  earlierDuties: z
    .object({
      "vendor-payment.approve": z.uuid().optional(),
      "vendor-bank.change": z.uuid().optional(),
    })
    .optional(),
});
type StandInAction = z.infer<typeof standInActionSchema>;

/**
 * Stands in for the payment steps (area 2, and F-5's hold) until they ask the
 * policy. It is open to any signed-in user on purpose, so that the chain's
 * own permission rule is what refuses, as it must for a direct call. A real
 * caller reads the requester and the earlier duties from its stored records;
 * this one takes them from the body only to play those records. Registered
 * only in this file's test app, never in production code.
 */
@Controller("test-only/actions")
class StandInActionController {
  constructor(@Inject(ModuleRef) private readonly modules: ModuleRef) {}

  @Post(":recordNo")
  @HttpCode(200)
  @Authenticated()
  async act(
    @Param("recordNo") recordNo: string,
    @Body(new ZodValidationPipe(standInActionSchema)) body: StandInAction,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const policy = this.modules.get(AuthorisationService, { strict: false });
    await policy.enforce(
      {
        actor: { userId: auth.user.id, role: auth.user.role },
        action: body.action,
        resource: { type: "Payment", id: recordNo },
        requesterUserId: body.requesterUserId,
        earlierDuties: body.earlierDuties,
      },
      { ip: req.ip ?? null, traceId: requestIdOf(req) },
    );
    return { data: { done: recordNo } };
  }
}

const SECOND_APPROVER = "approver.second@example.test";
const BY_THE_TEST = {
  actor: { kind: "system", name: "governance-controls test" },
  ip: null,
  traceId: "governance-controls-test",
} as const;
const STAND_IN = (recordNo: string) =>
  `${API}/test-only/approvals/${recordNo}/approve`;
const MANAGEMENT_APPROVES = `${API}/governance/matrix/MANAGEMENT/permissions/approvals.decide`;

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 3_600_000);
const awayNow = () => ({
  awayFrom: hoursFromNow(-1),
  awayUntil: hoursFromNow(1),
});

async function passwordSignIn(t: TestApp, email: string): Promise<Browser> {
  const res = await request(t.app.getHttpServer())
    .post(`${API}/auth/login`)
    .send({ email, password: TEST_DEMO_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`sign-in failed: ${String(res.status)} ${res.text}`);
  }
  return browserFrom(
    sessionResponseSchema.parse(res.body).data,
    res.headers["set-cookie"],
  );
}

describe("approval limits (F-3)", () => {
  let t: TestApp;
  const people = new Map<
    "requester" | "approver" | "substitute" | "management",
    string
  >();
  const sessions = new Map<Role | "SECOND_APPROVER", Browser>();
  const idOf = (who: Parameters<typeof people.get>[0]): string => {
    const found = people.get(who);
    if (!found) throw new Error(`no user for ${who}`);
    return found;
  };
  const as = (who: Role | "SECOND_APPROVER"): Browser => {
    const found = sessions.get(who);
    if (!found) throw new Error(`no session for ${who}`);
    return found;
  };

  /**
   * The sample chain: the Product Manager's SPRs go to the approver, whose
   * substitute is a second approver, and who escalates to Management.
   */
  const sample = (userId: string): ApprovalSetup => {
    const base = {
      userId,
      approverId: null,
      salesAmountApprovalLimit: "0.00",
      purchaseAmountApprovalLimit: "0.00",
      unlimitedSalesApproval: false,
      unlimitedPurchaseApproval: false,
      substituteUserId: null,
      awayFrom: null,
      awayUntil: null,
    };
    switch (userId) {
      case idOf("requester"):
        return { ...base, approverId: idOf("approver") };
      case idOf("approver"):
        return {
          ...base,
          approverId: idOf("management"),
          substituteUserId: idOf("substitute"),
          salesAmountApprovalLimit: "20000.00",
          purchaseAmountApprovalLimit: "5000.00",
        };
      case idOf("substitute"):
        return {
          ...base,
          approverId: idOf("management"),
          salesAmountApprovalLimit: "3000.00",
          purchaseAmountApprovalLimit: "3000.00",
        };
      default:
        return {
          ...base,
          unlimitedSalesApproval: true,
          unlimitedPurchaseApproval: true,
        };
    }
  };
  const change = (userId: string, overrides: Partial<ApprovalSetup> = {}) =>
    t.app
      .get(ApprovalSetupService)
      .save({ ...sample(userId), ...overrides }, BY_THE_TEST);

  const approve = (
    who: Role | "SECOND_APPROVER",
    action: string,
    amount: string,
    recordNo = "SPR-TEST-0001",
  ) =>
    call(t, as(who), "post", STAND_IN(recordNo), {
      csrf: true,
      body: { action, amount, requesterUserId: idOf("requester") },
    });
  const lastRefusal = async () =>
    (await auditEvents(t))
      .filter((event) => event.action === "governance.policy.refused")
      .at(-1);
  /**
   * Management holds approvals.decide in the default matrix, so an escalated
   * request reaches someone who may decide it. A test that proves the guard
   * still refuses a role without the permission takes it away for itself.
   */
  const withoutManagementApproving = async (work: () => Promise<void>) => {
    const grant = (granted: boolean) =>
      call(t, as("SYSTEM_ADMIN"), "put", MANAGEMENT_APPROVES, {
        csrf: true,
        body: { granted },
      });
    expect((await grant(false)).status).toBe(200);
    try {
      await work();
    } finally {
      await grant(true);
    }
  };

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({}, [StandInApprovalController], (builder) =>
      builder
        .overrideProvider(PermissionPolicy)
        .useClass(GovernancePermissionPolicy),
    );
    const users = t.app.get(UserRepository);
    const demoUser = async (role: Role) => {
      const user = await users.findByEmail(await emailForRole(role));
      if (!user) throw new Error(`no demo user for ${role}`);
      return user.id;
    };
    people.set("requester", await demoUser("PRODUCT_MANAGER"));
    people.set("approver", await demoUser("APPROVER"));
    people.set("management", await demoUser("MANAGEMENT"));
    const second = await users.create({
      email: SECOND_APPROVER,
      displayName: "Second Approver",
      role: "APPROVER",
      passwordHash: await t.app.get(PasswordHasher).hash(TEST_DEMO_PASSWORD),
    });
    people.set("substitute", second.id);
    for (const role of ROLES) sessions.set(role, await demoSignIn(t, role));
    sessions.set("SECOND_APPROVER", await passwordSignIn(t, SECOND_APPROVER));
  });
  beforeEach(async () => {
    for (const userId of people.values()) await change(userId);
  });
  afterAll(async () => {
    await t.close();
  });

  it("puts area 4's policy behind the permissions guard", () => {
    expect(t.app.get(PermissionPolicy)).toBeInstanceOf(
      GovernancePermissionPolicy,
    );
  });

  it("approves an amount at or under the approver's limit", async () => {
    for (const amount of ["4999.99", "5000.00"]) {
      expect((await approve("APPROVER", "spr.approve", amount)).status).toBe(
        200,
      );
    }
  });

  it("refuses an amount over the approver's limit, naming the rule", async () => {
    const res = await approve(
      "APPROVER",
      "spr.approve",
      "5000.01",
      "SPR-TEST-0002",
    );
    expect(res.status).toBe(403);
    const { error } = errorEnvelopeSchema.parse(res.body);
    // The caller learns nothing about the rules: the reason is in the audit trail only.
    expect({ ...error, traceId: "" }).toEqual({
      code: "FORBIDDEN",
      message: "You do not have access to this.",
      details: null,
      traceId: "",
    });
    expect(error.traceId).toBe(res.headers["x-request-id"]);
    const event = await lastRefusal();
    expect(event).toMatchObject({
      actor: { kind: "user", userId: idOf("approver"), role: "APPROVER" },
      entityType: "Spr",
      entityId: "SPR-TEST-0002",
      traceId: error.traceId,
      changes: {
        action: "spr.approve",
        rule: "approval-limit",
        amount: "5000.01",
        requesterUserId: idOf("requester"),
      },
    });
    expect(event?.changes?.reason).toContain("purchase approval limit");
    // An amount is a value masking may hide, so it stays out of the summary.
    expect(event?.summary).not.toContain("5000");
  });

  it("lets an approver with the unlimited flag approve any amount", async () => {
    const huge = "999999999999.99";
    expect((await approve("APPROVER", "spr.approve", huge)).status).toBe(403);
    await change(idOf("approver"), { unlimitedPurchaseApproval: true });
    expect((await approve("APPROVER", "spr.approve", huge)).status).toBe(200);
  });

  it("keeps sales and purchase limits apart", async () => {
    const amount = "10000.00";
    expect(
      (await approve("APPROVER", "sales-order.approve", amount)).status,
    ).toBe(200);
    expect((await approve("APPROVER", "spr.approve", amount)).status).toBe(403);
    expect(
      (await approve("APPROVER", "purchase-order.approve", amount)).status,
    ).toBe(403);
    await change(idOf("approver"), { unlimitedSalesApproval: true });
    expect((await approve("APPROVER", "spr.approve", amount)).status).toBe(403);
  });

  it("lets a substitute approve with their own limit while the approver is away", async () => {
    await change(idOf("approver"), awayNow());
    expect(
      (await approve("SECOND_APPROVER", "spr.approve", "3000.00")).status,
    ).toBe(200);
    // The approver's limit (5000.00) would cover this; the substitute's own does not.
    expect(
      (await approve("SECOND_APPROVER", "spr.approve", "3000.01")).status,
    ).toBe(403);
    expect((await lastRefusal())?.changes).toMatchObject({
      rule: "approval-limit",
    });
    // While they are away, the approver is not the one who decides.
    expect((await approve("APPROVER", "spr.approve", "100.00")).status).toBe(
      403,
    );
    expect((await lastRefusal())?.changes).toMatchObject({
      rule: "approval-route",
    });
  });

  it("refuses the substitute while the approver is present, before and after the absence", async () => {
    for (const absence of [
      { awayFrom: null, awayUntil: null },
      { awayFrom: hoursFromNow(1), awayUntil: hoursFromNow(2) },
      { awayFrom: hoursFromNow(-2), awayUntil: hoursFromNow(-1) },
    ]) {
      await change(idOf("approver"), absence);
      expect(
        (await approve("SECOND_APPROVER", "spr.approve", "100.00")).status,
      ).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "approval-route",
      });
    }
  });

  it("escalates to the absent approver's Approver ID when the substitute is away too", async () => {
    await change(idOf("approver"), awayNow());
    await change(idOf("substitute"), awayNow());
    expect(
      (await approve("SECOND_APPROVER", "spr.approve", "100.00")).status,
    ).toBe(403);
    expect((await lastRefusal())?.changes).toMatchObject({
      rule: "approval-route",
    });
    await withoutManagementApproving(async () => {
      expect(
        (await approve("MANAGEMENT", "spr.approve", "100.00")).status,
      ).toBe(403);
    });
    expect(
      (await approve("MANAGEMENT", "spr.approve", "250000.00")).status,
    ).toBe(200);
  });

  it("escalates when the absent approver has no substitute", async () => {
    await change(idOf("approver"), { ...awayNow(), substituteUserId: null });
    expect((await approve("MANAGEMENT", "spr.approve", "100.00")).status).toBe(
      200,
    );
    expect(
      (await approve("SECOND_APPROVER", "spr.approve", "100.00")).status,
    ).toBe(403);
  });

  it("names who should receive a request, for area 2 to route it", async () => {
    const policy = t.app.get(AuthorisationService);
    expect(await policy.deciderFor(idOf("requester"))).toEqual({
      kind: "approver",
      userId: idOf("approver"),
    });
    await change(idOf("approver"), awayNow());
    expect(await policy.deciderFor(idOf("requester"))).toEqual({
      kind: "substitute",
      userId: idOf("substitute"),
      standsInFor: idOf("approver"),
    });
    await change(idOf("substitute"), awayNow());
    expect(await policy.deciderFor(idOf("requester"))).toEqual({
      kind: "escalated",
      userId: idOf("management"),
      from: idOf("approver"),
    });
  });

  it("never lets anyone be their own substitute", async () => {
    await expect(
      change(idOf("approver"), { substituteUserId: idOf("approver") }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    // A row written by any other route is refused by the table itself.
    await expect(
      t.app.get(Database).client
        .$executeRaw`UPDATE "ApprovalUserSetup" SET "substituteUserId" = "userId" WHERE "userId" = ${idOf("approver")}::uuid`,
    ).rejects.toThrow(/not_own_substitute/);
  });

  it("refuses an action the policy does not know", async () => {
    expect((await approve("APPROVER", "order.delete", "1.00")).status).toBe(
      403,
    );
    expect((await lastRefusal())?.changes).toMatchObject({ rule: "action" });
  });

  it("audits every limit change with the before and after values", async () => {
    const changed = async () =>
      (await auditEvents(t)).filter(
        (event) => event.action === "governance.approval-setup.changed",
      );
    const before = (await changed()).length;
    await change(idOf("approver"), { purchaseAmountApprovalLimit: "6000.00" });
    const events = await changed();
    expect(events.length).toBe(before + 1);
    expect(events.at(-1)).toMatchObject({
      actor: BY_THE_TEST.actor,
      entityType: "ApprovalUserSetup",
      entityId: idOf("approver"),
      changes: {
        before: { purchaseAmountApprovalLimit: "5000.00" },
        after: { purchaseAmountApprovalLimit: "6000.00" },
      },
    });
    expect(events.at(-1)?.summary).not.toContain("6000");
    // Saving the same values again changes nothing and writes nothing.
    await change(idOf("approver"), { purchaseAmountApprovalLimit: "6000.00" });
    expect((await changed()).length).toBe(before + 1);
  });

  it("is asked before the action's transaction opens, so a refusal's audit is never rolled back", async () => {
    const policy = t.app.get(AuthorisationService);
    await expect(
      t.app.get(Database).transaction(() =>
        policy.enforce(
          {
            actor: { userId: idOf("approver"), role: "APPROVER" },
            action: "spr.approve",
            resource: { type: "Spr", id: "SPR-TEST-0003" },
            amount: "5000.01",
            requesterUserId: idOf("requester"),
          },
          BY_THE_TEST,
        ),
      ),
    ).rejects.toThrow(/before opening the transaction/);
  });

  it("refuses every role without approvals.decide at the guard, and audits each refusal", async () => {
    const refusals = async () =>
      (await auditEvents(t)).filter(
        (event) => event.action === "auth.permission.refused",
      );
    for (const role of ROLES) {
      if (DEFAULT_ROLE_PERMISSIONS[role].includes("approvals.decide")) continue;
      const before = (await refusals()).length;
      const res = await approve(role, "spr.approve", "100.00");
      expect(res.status, role).toBe(403);
      expect(errorEnvelopeSchema.parse(res.body).error.code, role).toBe(
        "FORBIDDEN",
      );
      const events = await refusals();
      expect(events.length, role).toBe(before + 1);
      expect(events.at(-1)?.changes, role).toMatchObject({
        permission: "approvals.decide",
      });
    }
  });
});

describe("the approval setup seed (F-3)", () => {
  let t: TestApp;
  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("sets up the sample chain, and a second run changes nothing", async () => {
    await seedApprovalSetups(t.app);
    const users = t.app.get(UserRepository);
    const setups = t.app.get(ApprovalSetupRepository);
    const idFor = async (role: Role) => {
      const user = await users.findByEmail(await emailForRole(role));
      if (!user) throw new Error(`no demo user for ${role}`);
      return user.id;
    };
    const [requester, approver, management] = await Promise.all([
      idFor("PRODUCT_MANAGER"),
      idFor("APPROVER"),
      idFor("MANAGEMENT"),
    ]);
    expect(await setups.find(requester)).toMatchObject({
      approverId: approver,
    });
    expect(await setups.find(approver)).toMatchObject({
      approverId: management,
      salesAmountApprovalLimit: "20000.00",
      purchaseAmountApprovalLimit: "5000.00",
      unlimitedSalesApproval: false,
      unlimitedPurchaseApproval: false,
      substituteUserId: null,
    });
    expect(await setups.find(management)).toMatchObject({
      unlimitedSalesApproval: true,
      unlimitedPurchaseApproval: true,
    });

    const before = (await auditEvents(t)).length;
    await seedApprovalSetups(t.app);
    expect((await auditEvents(t)).length).toBe(before);
  });
});

describe("no self-approval and segregation of duties (F-4)", () => {
  let t: TestApp;
  const ids = new Map<string, string>();
  const sessions = new Map<string, Browser>();
  const id = (who: string): string => {
    const found = ids.get(who);
    if (!found) throw new Error(`no user for ${who}`);
    return found;
  };
  const as = (who: string): Browser => {
    const found = sessions.get(who);
    if (!found) throw new Error(`no session for ${who}`);
    return found;
  };

  /** F-3's sample chain: requester, approver, substitute, then Management. */
  const sample = (userId: string): ApprovalSetup => {
    const base = {
      userId,
      approverId: null,
      salesAmountApprovalLimit: "0.00",
      purchaseAmountApprovalLimit: "0.00",
      unlimitedSalesApproval: false,
      unlimitedPurchaseApproval: false,
      substituteUserId: null,
      awayFrom: null,
      awayUntil: null,
    };
    if (userId === id("requester")) {
      return { ...base, approverId: id("approver") };
    }
    if (userId === id("approver")) {
      return {
        ...base,
        approverId: id("management"),
        substituteUserId: id("substitute"),
        salesAmountApprovalLimit: "20000.00",
        purchaseAmountApprovalLimit: "5000.00",
      };
    }
    if (userId === id("substitute")) {
      return {
        ...base,
        approverId: id("management"),
        purchaseAmountApprovalLimit: "3000.00",
      };
    }
    if (userId === id("management")) {
      return {
        ...base,
        unlimitedSalesApproval: true,
        unlimitedPurchaseApproval: true,
      };
    }
    return base;
  };
  const change = (userId: string, overrides: Partial<ApprovalSetup> = {}) =>
    t.app
      .get(ApprovalSetupService)
      .save({ ...sample(userId), ...overrides }, BY_THE_TEST);
  const byUser = (who: string, role: Role) => ({
    actor: { kind: "user" as const, userId: id(who), role },
    ip: null,
    traceId: `f4-${who}`,
  });

  const approveSpr = (who: string, raisedBy: string, recordNo = "SPR-F4-1") =>
    call(t, as(who), "post", STAND_IN(recordNo), {
      csrf: true,
      body: {
        action: "spr.approve",
        amount: "100.00",
        requesterUserId: id(raisedBy),
      },
    });
  const act = (
    who: string,
    action: string,
    earlierDuties: Record<string, string> = {},
    recordNo = "PAY-F4-1",
  ) =>
    call(t, as(who), "post", `${API}/test-only/actions/${recordNo}`, {
      csrf: true,
      body: { action, earlierDuties },
    });
  const lastRefusal = async () =>
    (await auditEvents(t))
      .filter((event) => event.action === "governance.policy.refused")
      .at(-1);
  /** Grants a permission for the length of one piece of work, through the matrix route. */
  const withGrant = async (
    role: Role,
    permission: string,
    work: () => Promise<void>,
  ) => {
    const cell = `${API}/governance/matrix/${role}/permissions/${permission}`;
    const grant = (granted: boolean) =>
      call(t, as("SYSTEM_ADMIN"), "put", cell, {
        csrf: true,
        body: { granted },
      });
    expect((await grant(true)).status).toBe(200);
    try {
      await work();
    } finally {
      await grant(false);
    }
  };

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp(
      {},
      [StandInApprovalController, StandInActionController],
      (builder) =>
        builder
          .overrideProvider(PermissionPolicy)
          .useClass(GovernancePermissionPolicy),
    );
    const users = t.app.get(UserRepository);
    const hasher = t.app.get(PasswordHasher);
    for (const [who, role] of [
      ["requester", "PRODUCT_MANAGER"],
      ["approver", "APPROVER"],
      ["management", "MANAGEMENT"],
      ["admin", "SYSTEM_ADMIN"],
      ["finance", "FINANCE"],
    ] as const) {
      const user = await users.findByEmail(await emailForRole(role));
      if (!user) throw new Error(`no demo user for ${role}`);
      ids.set(who, user.id);
      sessions.set(role, await demoSignIn(t, role));
    }
    for (const [who, email, role, name] of [
      ["substitute", SECOND_APPROVER, "APPROVER", "Second Approver"],
      ["finance2", "finance.second@example.test", "FINANCE", "Second Finance"],
    ] as const) {
      const user = await users.create({
        email,
        displayName: name,
        role,
        passwordHash: await hasher.hash(TEST_DEMO_PASSWORD),
      });
      ids.set(who, user.id);
      sessions.set(who, await passwordSignIn(t, email));
    }
  });
  beforeEach(async () => {
    for (const who of ["requester", "approver", "substitute", "management"]) {
      await change(id(who));
    }
  });
  afterAll(async () => {
    await t.close();
  });

  describe("no self-approval", () => {
    it("refuses an approver approving a request they raised", async () => {
      // The approver's own requests go to Management, so the route would not
      // name them: the refusal must come from no-self-approval itself.
      const res = await approveSpr("APPROVER", "approver");
      expect(res.status).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "no-self-approval",
        requesterUserId: id("approver"),
      });
    });

    it("refuses a substitute who raised the request, and passes it up to the escalation", async () => {
      await change(id("substitute"), { approverId: id("approver") });
      await change(id("approver"), awayNow());
      expect((await approveSpr("substitute", "substitute")).status).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "no-self-approval",
      });
      expect(
        await t.app.get(AuthorisationService).deciderFor(id("substitute")),
      ).toEqual({
        kind: "escalated",
        userId: id("management"),
        from: id("approver"),
      });
      await withGrant("MANAGEMENT", "approvals.decide", async () => {
        expect((await approveSpr("MANAGEMENT", "substitute")).status).toBe(200);
      });
    });

    it("refuses the requester when the escalation leads back to them, and records that nobody may decide", async () => {
      await change(id("management"), { approverId: id("approver") });
      await change(id("approver"), awayNow());
      await change(id("substitute"), awayNow());
      const decider = await t.app
        .get(AuthorisationService)
        .deciderFor(id("management"));
      expect(decider.kind).toBe("none");
      await withGrant("MANAGEMENT", "approvals.decide", async () => {
        expect((await approveSpr("MANAGEMENT", "management")).status).toBe(403);
        expect((await lastRefusal())?.changes).toMatchObject({
          rule: "no-self-approval",
        });
      });
      expect((await approveSpr("APPROVER", "management")).status).toBe(403);
      const refusal = await lastRefusal();
      expect(refusal?.changes).toMatchObject({ rule: "approval-route" });
      expect(refusal?.changes?.reason).toContain("raised the request");
    });

    it("refuses the requester after a change of role", async () => {
      const database = t.app.get(Database).client;
      // The guard reads the role on every request, so the same session now
      // passes as an approver; only the policy still knows who raised it.
      await database.user.update({
        where: { id: id("requester") },
        data: { role: "APPROVER" },
      });
      try {
        expect((await approveSpr("PRODUCT_MANAGER", "requester")).status).toBe(
          403,
        );
        expect((await lastRefusal())?.changes).toMatchObject({
          rule: "no-self-approval",
        });
      } finally {
        await database.user.update({
          where: { id: id("requester") },
          data: { role: "PRODUCT_MANAGER" },
        });
      }
    });

    it("never lets the system admin approve, post or pay, even by a direct call", async () => {
      const guarded = await approveSpr("SYSTEM_ADMIN", "requester");
      expect(guarded.status).toBe(403);
      const atTheGuard = (await auditEvents(t))
        .filter((event) => event.action === "auth.permission.refused")
        .at(-1);
      expect(atTheGuard?.changes).toMatchObject({
        reason: "the system admin never holds this permission",
      });
      for (const action of [
        "customer-payment.confirm",
        "vendor-payment.approve",
        "vendor-payment.release",
      ]) {
        expect((await act("SYSTEM_ADMIN", action)).status, action).toBe(403);
        expect((await lastRefusal())?.changes, action).toMatchObject({
          rule: "system-admin",
        });
      }
    });
  });

  describe("nobody changes their own approval setup", () => {
    it("refuses anyone changing their own limit or substitute, even with roles.manage", async () => {
      await t.app
        .get(ApprovalSetupService)
        .save(sample(id("admin")), BY_THE_TEST);
      const service = t.app.get(ApprovalSetupService);
      for (const own of [
        { purchaseAmountApprovalLimit: "1000000.00" },
        { substituteUserId: id("approver") },
      ]) {
        await expect(
          service.save(
            { ...sample(id("admin")), ...own },
            byUser("admin", "SYSTEM_ADMIN"),
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        expect(await lastRefusal()).toMatchObject({
          entityType: "ApprovalUserSetup",
          entityId: id("admin"),
          changes: { action: "approval-setup.change", rule: "own-setup" },
        });
      }
    });

    it("lets someone holding roles.manage change another person's setup, audited as them", async () => {
      const saved = await t.app
        .get(ApprovalSetupService)
        .save(
          { ...sample(id("approver")), purchaseAmountApprovalLimit: "6000.00" },
          byUser("admin", "SYSTEM_ADMIN"),
        );
      expect(saved).toBe(true);
      const event = (await auditEvents(t))
        .filter((e) => e.action === "governance.approval-setup.changed")
        .at(-1);
      expect(event?.actor).toMatchObject({
        kind: "user",
        userId: id("admin"),
      });
    });

    it("refuses someone without roles.manage changing any setup", async () => {
      await expect(
        t.app
          .get(ApprovalSetupService)
          .save(
            { ...sample(id("requester")), purchaseAmountApprovalLimit: "1.00" },
            byUser("approver", "APPROVER"),
          ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "permission",
      });
    });
  });

  describe("segregation of duties", () => {
    it("refuses the same person approving a vendor payment and clearing its hold", async () => {
      const approvedBy = { "vendor-payment.approve": id("finance") };
      expect(
        (await act("FINANCE", "payment-hold.clear", approvedBy)).status,
      ).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "segregation-of-duties",
        earlierDuties: approvedBy,
      });
      expect(
        (await act("finance2", "payment-hold.clear", approvedBy)).status,
      ).toBe(200);
    });

    it("refuses the same person clearing a bank-detail hold after changing the details", async () => {
      const changedBy = { "vendor-bank.change": id("finance") };
      expect(
        (await act("FINANCE", "payment-hold.clear", changedBy)).status,
      ).toBe(403);
      expect(
        (await act("finance2", "payment-hold.clear", changedBy)).status,
      ).toBe(200);
    });

    it("refuses whoever changed a vendor's bank details approving or releasing a payment to that vendor", async () => {
      const changedBy = { "vendor-bank.change": id("finance") };
      await withGrant("FINANCE", "payments.post", async () => {
        for (const action of [
          "vendor-payment.approve",
          "vendor-payment.release",
        ]) {
          expect((await act("FINANCE", action, changedBy)).status, action).toBe(
            403,
          );
          expect((await lastRefusal())?.changes, action).toMatchObject({
            rule: "segregation-of-duties",
          });
          expect(
            (await act("finance2", action, changedBy)).status,
            action,
          ).toBe(200);
        }
      });
    });

    it("keeps confirming a customer's payment out of every pair", async () => {
      const everything = {
        "vendor-payment.approve": id("finance"),
        "vendor-bank.change": id("finance"),
      };
      expect(
        (await act("FINANCE", "customer-payment.confirm", everything)).status,
      ).toBe(200);
    });
  });

  it("audits the refusal with the rule that decided, shown the way F-1 shows one", async () => {
    const cases = [
      () => approveSpr("APPROVER", "approver", "SPR-F4-AUDIT"),
      () =>
        act(
          "FINANCE",
          "payment-hold.clear",
          {
            "vendor-payment.approve": id("finance"),
          },
          "PAY-F4-AUDIT",
        ),
    ];
    for (const [index, run] of cases.entries()) {
      const res = await run();
      const { error } = errorEnvelopeSchema.parse(res.body);
      expect({ ...error, traceId: "" }, String(index)).toEqual({
        code: "FORBIDDEN",
        message: "You do not have access to this.",
        details: null,
        traceId: "",
      });
      const event = await lastRefusal();
      expect(event?.traceId, String(index)).toBe(res.headers["x-request-id"]);
      expect(event?.changes?.rule, String(index)).toMatch(
        /^(no-self-approval|segregation-of-duties)$/,
      );
      expect(event?.summary, String(index)).toContain("was refused");
    }
  });
});

describe("the bank-detail hold (F-5)", () => {
  it.todo("holds a payment whose bank details differ from the vendor record");
  it.todo("never trusts the bank details on the PI, only the record");
  it.todo("clears the hold only with Finance and a second approver");
  it.todo("refuses the second approver being the requester or the first one");
  it.todo("emits payment.held and payment.hold-cleared, both audited");
});

describe("masking for each role (F-1 onwards)", () => {
  it.todo(
    "hides bank details from every role outside Finance, with the reason",
  );
  it.todo("hides prices from the roles that do not work with pricing");
  it.todo("never sends a masked value in the response body");
  it.todo(
    "applies the data scope, so a Product Manager sees only their brands",
  );
});

describe("a direct API call being refused (E2E #3)", () => {
  it.todo("refuses a script that calls an action endpoint without the right");
  it.todo(
    "returns the standard envelope with a trace id and audits the refusal",
  );
  it.todo("refuses a disabled user's token on the next request");
});

describe("payment confirmation (F-1 with C-1)", () => {
  it.todo("records the payment type, prepayment among them");
  it.todo("lets a prepayment release the payment gate for its order only");
});
