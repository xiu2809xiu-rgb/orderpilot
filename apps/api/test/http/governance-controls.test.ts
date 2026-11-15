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
  auditEventViewSchema,
  decimalStringSchema,
  errorEnvelopeSchema,
  sessionResponseSchema,
  type Role,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import type { Request } from "express";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
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
import { AppConfig } from "../../src/config/app-config.js";
import { Database } from "../../src/database/database.js";
import { seedApprovalSetups } from "../../src/modules/governance/approval-setup-seed.js";
import { ApprovalSetupRepository } from "../../src/modules/governance/approval-setup.repository.js";
import { ApprovalSetupService } from "../../src/modules/governance/approval-setup.service.js";
import { AuthorisationService } from "../../src/modules/governance/authorisation.service.js";
import { seedVendorBankBaselines } from "../../src/modules/governance/bank-baseline-seed.js";
import { BankDetailHoldService } from "../../src/modules/governance/bank-detail-hold.service.js";
import { BankHoldRepository } from "../../src/modules/governance/bank-hold.repository.js";
import type { ApprovalSetup } from "../../src/modules/governance/domain/approval-setup.js";
import { digestOf } from "../../src/modules/governance/domain/bank-comparison.js";
import {
  BankDetails,
  BankFingerprinter,
  type RawBankDetails,
} from "../../src/modules/governance/domain/bank-details.js";
import { GovernancePermissionPolicy } from "../../src/modules/governance/governance-permission-policy.js";
import {
  bankHoldListResponseSchema,
  bankHoldResponseSchema,
} from "../../src/modules/governance/governance.schemas.js";
import {
  MASTER_DATA_READER,
  type MasterDataReader,
  type MasterDataVendor,
} from "../../src/modules/master-data/domain/master-data-reader.js";
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
  earlierDuties: z.object({ "spr.route": z.uuid().optional() }).optional(),
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
        earlierDuties: body.earlierDuties,
      },
      { ip: req.ip ?? null, traceId: requestIdOf(req) },
    );
    return { data: { approved: recordNo } };
  }
}

const standInRouteSchema = z.object({ requesterUserId: z.uuid().optional() });
type StandInRoute = z.infer<typeof standInRouteSchema>;

/**
 * Stands in for area 2's routing of an SPR (#251) until it asks the policy: the
 * guard checks spr.route, then the route asks the policy before it acts.
 * Registered only in this file's test app, never in production code.
 */
@Controller("test-only/sprs")
class StandInRouteController {
  constructor(@Inject(ModuleRef) private readonly modules: ModuleRef) {}

  @Post(":recordNo/route")
  @HttpCode(200)
  @RequirePermission("spr.route")
  async route(
    @Param("recordNo") recordNo: string,
    @Body(new ZodValidationPipe(standInRouteSchema)) body: StandInRoute,
    @Auth() auth: AuthContext,
    @Req() req: Request,
  ) {
    const policy = this.modules.get(AuthorisationService, { strict: false });
    await policy.enforce(
      {
        actor: { userId: auth.user.id, role: auth.user.role },
        action: "spr.route",
        resource: { type: "Spr", id: recordNo },
        requesterUserId: body.requesterUserId,
      },
      { ip: req.ip ?? null, traceId: requestIdOf(req) },
    );
    return { data: { routed: recordNo } };
  }
}

const standInActionSchema = z.object({
  action: z.string().min(1),
  requesterUserId: z.uuid().optional(),
  vendorNo: z.string().min(1).optional(),
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
        vendorNo: body.vendorNo,
        earlierDuties: body.earlierDuties,
      },
      { ip: req.ip ?? null, traceId: requestIdOf(req) },
    );
    return { data: { done: recordNo } };
  }
}

const SECOND_APPROVER = "approver.second@example.test";
const TEST_BANK_FINGERPRINT_KEY =
  "test-only-bank-fingerprint-key-0000000000000000";
const keyWarnings = (t: TestApp) =>
  t
    .logLines()
    .filter(
      (line) =>
        typeof line.msg === "string" &&
        line.msg.includes("BANK_FINGERPRINT_KEY"),
    );
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

  it("keeps the old chain, its substitutes and its limits while APPROVER_GROUP is off (#252)", async () => {
    expect(t.app.get(AppConfig).governance.approverGroup).toBe(false);
    // The chain names the approver: the second approver may not decide.
    expect(
      (await approve("SECOND_APPROVER", "spr.approve", "100.00")).status,
    ).toBe(403);
    expect((await lastRefusal())?.changes).toMatchObject({
      rule: "approval-route",
    });
    // Limits apply under the old chain, whatever APPROVAL_LIMITS says.
    expect((await approve("APPROVER", "spr.approve", "5000.01")).status).toBe(
      403,
    );
    expect((await lastRefusal())?.changes).toMatchObject({
      rule: "approval-limit",
    });
    // And the substitute decides while the approver is away.
    await change(idOf("approver"), awayNow());
    expect(
      (await approve("SECOND_APPROVER", "spr.approve", "100.00")).status,
    ).toBe(200);
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
    vendorNo?: string,
  ) =>
    call(t, as(who), "post", `${API}/test-only/actions/${recordNo}`, {
      csrf: true,
      body: { action, earlierDuties, vendorNo },
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
      expect((await approveSpr("MANAGEMENT", "substitute")).status).toBe(200);
    });

    it("refuses the requester when the escalation leads back to them, and records that nobody may decide", async () => {
      await change(id("management"), { approverId: id("approver") });
      await change(id("approver"), awayNow());
      await change(id("substitute"), awayNow());
      const decider = await t.app
        .get(AuthorisationService)
        .deciderFor(id("management"));
      expect(decider.kind).toBe("none");
      expect((await approveSpr("MANAGEMENT", "management")).status).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "no-self-approval",
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
      const approvedBy = { "vendor-payment.approve": id("approver") };
      expect(
        (await act("APPROVER", "payment-hold.clear", approvedBy)).status,
      ).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "segregation-of-duties",
        earlierDuties: approvedBy,
      });
      // Someone else passes this rule and stops at the next: no real hold here.
      expect(
        (await act("substitute", "payment-hold.clear", approvedBy)).status,
      ).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "hold-verification",
      });
    });

    it("refuses the same person clearing a bank-detail hold after changing the details", async () => {
      const changedBy = { "vendor-bank.change": id("approver") };
      expect(
        (await act("APPROVER", "payment-hold.clear", changedBy)).status,
      ).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "segregation-of-duties",
      });
      expect(
        (await act("substitute", "payment-hold.clear", changedBy)).status,
      ).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "hold-verification",
      });
    });

    it("refuses whoever changed a vendor's bank details approving or releasing a payment to that vendor", async () => {
      const changedBy = { "vendor-bank.change": id("finance") };
      await withGrant("FINANCE", "payments.post", async () => {
        for (const action of [
          "vendor-payment.approve",
          "vendor-payment.release",
        ]) {
          expect(
            (await act("FINANCE", action, changedBy, "PAY-F4-1", "V-F4-1"))
              .status,
            action,
          ).toBe(403);
          expect((await lastRefusal())?.changes, action).toMatchObject({
            rule: "segregation-of-duties",
          });
          expect(
            (await act("finance2", action, changedBy, "PAY-F4-1", "V-F4-1"))
              .status,
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
          "APPROVER",
          "payment-hold.clear",
          {
            "vendor-payment.approve": id("approver"),
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

  // Obviously fake: ZZ is not a country, and the bank names itself a demo.
  const RECORD = {
    bankAccountNo: "000000009901",
    swiftCode: "DEMOZZ00",
    iban: "ZZ00DEMO0000000009901",
  };
  const CHANGED = {
    bankAccountNo: "000000007702",
    swiftCode: "DEMOZZ77",
    iban: "ZZ00DEMO0000000007702",
  };
  const HOLDS = `${API}/governance/bank-holds`;
  const STORED_CONTACT = "Called the number on the stored vendor record.";

  let vendors = 0;
  const nextVendor = () => {
    vendors += 1;
    return `V-F5-${String(vendors).padStart(3, "0")}`;
  };
  const control = () => t.app.get(BankDetailHoldService);
  const setBaseline = (vendorNo: string, details: RawBankDetails = RECORD) =>
    control().recordBaseline(
      { vendorNo, accountCode: "MAIN", details },
      BY_THE_TEST,
    );
  const reportPi = (
    vendorNo: string,
    details: RawBankDetails,
    changedBy = "support",
  ) =>
    control().reportDetails(
      {
        vendorNo,
        details,
        source: "vendor-pi",
        sourceRef: "PI-F5-1",
        changedByUserId: id(changedBy),
      },
      BY_THE_TEST,
    );
  interface HeldVendor {
    readonly vendorNo: string;
    readonly holdId: string;
  }
  /** A vendor with stored details, and a PI that differs from them. */
  const heldVendor = async (changedBy = "support"): Promise<HeldVendor> => {
    const vendorNo = nextVendor();
    await setBaseline(vendorNo);
    const report = await reportPi(vendorNo, CHANGED, changedBy);
    if (report.outcome !== "held") throw new Error("expected a hold");
    return { vendorNo, holdId: report.holdId };
  };

  const verify = (who: string, holdId: string, body: object = {}) =>
    call(t, as(who), "post", `${HOLDS}/${holdId}/verifications`, {
      csrf: true,
      body: {
        outcome: "confirmed",
        contactedAt: new Date().toISOString(),
        contactFromStoredRecord: true,
        reason: STORED_CONTACT,
        ...body,
      },
    });
  const clear = (who: string, holdId: string, body: object = {}) =>
    call(t, as(who), "post", `${HOLDS}/${holdId}/clear`, {
      csrf: true,
      body: {
        resolution: "accept-new-details",
        reason: "The verification is sound and the change is genuine.",
        ...body,
      },
    });
  const view = (who: string, holdId: string) =>
    call(t, as(who), "get", `${HOLDS}/${holdId}`);
  const holdSeenBy = async (who: string, holdId: string) => {
    const res = await view(who, holdId);
    expect(res.status).toBe(200);
    return bankHoldResponseSchema.parse(res.body).data;
  };
  const pay = (
    who: string,
    vendorNo?: string,
    action = "vendor-payment.release",
    earlierDuties: Record<string, string> = {},
  ) =>
    call(t, as(who), "post", `${API}/test-only/actions/PAY-F5-1`, {
      csrf: true,
      body: { action, vendorNo, earlierDuties },
    });

  const events = async (action: string, entityId?: string) =>
    (await auditEvents(t)).filter(
      (event) =>
        event.action === action &&
        (entityId === undefined || event.entityId === entityId),
    );
  const lastRefusal = async () =>
    (await events("governance.policy.refused")).at(-1);
  const expectRule = async (rule: string) => {
    expect((await lastRefusal())?.changes).toMatchObject({ rule });
  };
  /** Grants a permission for one piece of work, through the matrix route. */
  const withGrant = async (
    role: Role,
    permission: string,
    work: () => Promise<void>,
  ) => {
    const cell = `${API}/governance/matrix/${role}/permissions/${permission}`;
    const grant = (granted: boolean) =>
      call(t, as("admin"), "put", cell, { csrf: true, body: { granted } });
    expect((await grant(true)).status).toBe(200);
    try {
      await work();
    } finally {
      await grant(false);
    }
  };
  const withFinancePaying = (work: () => Promise<void>) =>
    withGrant("FINANCE", "payments.post", work);

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp(
      { BANK_FINGERPRINT_KEY: TEST_BANK_FINGERPRINT_KEY },
      [StandInActionController],
    );
    const users = t.app.get(UserRepository);
    const hasher = t.app.get(PasswordHasher);
    for (const [who, role] of [
      ["finance", "FINANCE"],
      ["approver", "APPROVER"],
      ["support", "SUPPORT"],
      ["warehouse", "WAREHOUSE"],
      ["auditor", "AUDITOR"],
      ["admin", "SYSTEM_ADMIN"],
    ] as const) {
      const user = await users.findByEmail(await emailForRole(role));
      if (!user) throw new Error(`no demo user for ${role}`);
      ids.set(who, user.id);
      sessions.set(who, await demoSignIn(t, role));
    }
    for (const [who, email, role, name] of [
      ["finance2", "finance.second@example.test", "FINANCE", "Second Finance"],
      ["approver2", SECOND_APPROVER, "APPROVER", "Second Approver"],
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
  afterAll(async () => {
    await t.close();
  });

  it("logs no warning about the key when it has one", () => {
    expect(keyWarnings(t)).toEqual([]);
  });

  it("fingerprints with the key in the configuration", () => {
    const digestBy = (fingerprinter: BankFingerprinter) =>
      fingerprinter.digest("iban", RECORD.iban);
    expect(digestBy(t.app.get(BankFingerprinter))).toBe(
      digestBy(new BankFingerprinter(TEST_BANK_FINGERPRINT_KEY)),
    );
  });

  describe("what opens a hold", () => {
    it("opens nothing when the details match, however they are written", async () => {
      const vendorNo = nextVendor();
      await setBaseline(vendorNo);
      for (const details of [
        RECORD,
        {
          bankAccountNo: "0000 0000 9901",
          swiftCode: "demozz00xxx",
          iban: "zz00 demo 0000 0000 0990 1",
        },
        // A document that does not print one field has not changed it.
        { bankAccountNo: RECORD.bankAccountNo },
      ]) {
        expect(await reportPi(vendorNo, details)).toEqual({ outcome: "match" });
      }
      expect(await control().openHoldsFor(vendorNo)).toEqual([]);
    });

    it.each([
      { label: "Bank Account No.", field: "bankAccountNo" },
      { label: "SWIFT Code", field: "swiftCode" },
      { label: "IBAN", field: "iban" },
    ] as const)(
      "opens a hold naming only $label when it alone differs",
      async ({ field }) => {
        const vendorNo = nextVendor();
        await setBaseline(vendorNo);
        const report = await reportPi(vendorNo, {
          ...RECORD,
          [field]: CHANGED[field],
        });
        expect(report).toMatchObject({
          outcome: "held",
          differingFields: [field],
        });
      },
    );

    it("holds a payment whose bank details differ from the vendor record", async () => {
      const { vendorNo, holdId } = await heldVendor();
      await withFinancePaying(async () => {
        for (const action of [
          "vendor-payment.release",
          "vendor-payment.approve",
        ]) {
          const res = await pay("finance", vendorNo, action);
          expect(res.status, action).toBe(403);
          // F-1's generic envelope: the rule, the reason and the hold stay out of it.
          const { error } = errorEnvelopeSchema.parse(res.body);
          expect({ ...error, traceId: "" }, action).toEqual({
            code: "FORBIDDEN",
            message: "You do not have access to this.",
            details: null,
            traceId: "",
          });
          expect(res.text, action).not.toContain(holdId);
          const refusal = await lastRefusal();
          expect(refusal?.changes, action).toMatchObject({
            action,
            rule: "bank-detail-hold",
            vendorNo,
            holdIds: [holdId],
          });
          expect(refusal?.changes?.reason, action).toContain(holdId);
        }
        const decision = await t.app.get(AuthorisationService).decide({
          actor: { userId: id("finance"), role: "FINANCE" },
          action: "vendor-payment.release",
          resource: { type: "Payment", id: "PAY-F5-1" },
          vendorNo,
        });
        expect(decision).toMatchObject({
          outcome: "refused",
          rule: "bank-detail-hold",
        });
        expect(decision.reason).toContain(holdId);
      });
    });

    it("opens the same hold for an edit to the vendor record", async () => {
      const vendorNo = nextVendor();
      await setBaseline(vendorNo);
      const report = await control().reportDetails(
        {
          vendorNo,
          accountCode: "MAIN",
          details: { ...RECORD, iban: null },
          source: "vendor-record",
          sourceRef: "CR-F5-1",
          changedByUserId: id("finance"),
        },
        BY_THE_TEST,
      );
      expect(report).toMatchObject({
        outcome: "held",
        differingFields: ["iban"],
      });
      await withFinancePaying(async () => {
        expect((await pay("finance2", vendorNo)).status).toBe(403);
        await expectRule("bank-detail-hold");
      });
    });

    it("never trusts the bank details on the PI, only the record", async () => {
      const vendorNo = nextVendor();
      // Nothing on record yet: the PI is held, and never becomes the record.
      const first = await reportPi(vendorNo, CHANGED);
      const second = await reportPi(vendorNo, CHANGED);
      expect(first).toMatchObject({ outcome: "held" });
      expect(second).toEqual(first);
      await setBaseline(vendorNo, RECORD);
      expect(await reportPi(vendorNo, RECORD)).toEqual({ outcome: "match" });
    });

    it("matches vendors on their Business Central number, never their details", async () => {
      const { vendorNo } = await heldVendor();
      const other = nextVendor();
      await setBaseline(other, CHANGED);
      expect(await reportPi(other, CHANGED)).toEqual({ outcome: "match" });
      await withFinancePaying(async () => {
        expect((await pay("finance2", other)).status).toBe(200);
        expect((await pay("finance2", vendorNo)).status).toBe(403);
      });
    });

    it("compares a PI only with its own vendor's record when two vendors share a name", async () => {
      const first = nextVendor();
      const second = nextVendor();
      const vendor = (no: string): MasterDataVendor => ({
        no,
        name: "Same Name Trading Pte Ltd (synthetic)",
        currencyCode: "USD",
        paymentTermsCode: "30 DAYS",
        balanceLcy: "0.00",
      });
      const reader = t.app.get<MasterDataReader>(MASTER_DATA_READER, {
        strict: false,
      });
      const vendors = vi
        .spyOn(reader, "vendors")
        .mockResolvedValue([vendor(first), vendor(second)]);
      const accounts = vi
        .spyOn(reader, "vendorBankAccounts")
        .mockImplementation((no) =>
          Promise.resolve([
            {
              code: "MAIN",
              name: "Demo Bank (not a real bank)",
              ...(no === first ? RECORD : CHANGED),
            },
          ]),
        );
      try {
        await seedVendorBankBaselines(t.app);
      } finally {
        vendors.mockRestore();
        accounts.mockRestore();
      }

      expect(await reportPi(first, RECORD)).toEqual({ outcome: "match" });
      expect(await reportPi(second, CHANGED)).toEqual({ outcome: "match" });
      // The other vendor's details are a difference, whatever the name says.
      expect(await reportPi(first, CHANGED)).toMatchObject({
        outcome: "held",
        differingFields: ["bankAccountNo", "swiftCode", "iban"],
      });
      await withFinancePaying(async () => {
        expect((await pay("finance2", second)).status).toBe(200);
        expect((await pay("finance2", first)).status).toBe(403);
      });
    });

    it("keeps one hold for one set of new details, and opens another for different ones", async () => {
      const { vendorNo, holdId } = await heldVendor();
      expect(await reportPi(vendorNo, CHANGED)).toMatchObject({ holdId });
      const other = await reportPi(vendorNo, {
        ...CHANGED,
        bankAccountNo: "000000003303",
      });
      expect(other).toMatchObject({ outcome: "held" });
      expect(other).not.toMatchObject({ holdId });
      expect(await control().openHoldsFor(vendorNo)).toHaveLength(2);
      expect(
        (await events("governance.bank-hold.opened")).filter(
          (event) => event.changes?.vendorNo === vendorNo,
        ),
      ).toHaveLength(2);
    });

    it("opens one hold when two reports race", async () => {
      const vendorNo = nextVendor();
      await setBaseline(vendorNo);
      const [first, second] = await Promise.all([
        reportPi(vendorNo, CHANGED),
        reportPi(vendorNo, CHANGED),
      ]);
      expect(second).toEqual(first);
      expect(await control().openHoldsFor(vendorNo)).toHaveLength(1);
    });

    it("is held to one open hold per set of new details by the table itself", async () => {
      const { vendorNo } = await heldVendor();
      const repository = t.app.get(BankHoldRepository);
      const [open] = await repository.openHoldsFor(vendorNo);
      if (!open) throw new Error("expected a hold");
      const copy = {
        vendorNo,
        accountCode: open.accountCode,
        source: open.source,
        sourceRef: open.sourceRef,
        changedByUserId: open.changedByUserId,
        differingFields: open.differingFields,
        beforeMasks: open.beforeMasks,
        proposed: open.proposed,
        openedAt: open.openedAt,
      };
      await expect(
        repository.insert({
          ...copy,
          proposedDigest: digestOf(open.proposed),
        }),
      ).rejects.toThrow();
      // The same row with other details goes in, so the index is what refused.
      await expect(
        repository.insert({
          ...copy,
          proposedDigest: "another-set-of-details",
        }),
      ).resolves.toMatchObject({ vendorNo });
    });

    it("ignores a document with no bank details on it", async () => {
      const vendorNo = nextVendor();
      await setBaseline(vendorNo);
      expect(await reportPi(vendorNo, {})).toEqual({ outcome: "no-details" });
      expect(await control().openHoldsFor(vendorNo)).toEqual([]);
    });

    it("refuses a vendor payment that does not name its vendor", async () => {
      await withFinancePaying(async () => {
        expect((await pay("finance2")).status).toBe(403);
        await expectRule("bank-detail-hold");
      });
    });

    it("tells area 2 what is held, and reports nothing for a clear vendor", async () => {
      const { vendorNo, holdId } = await heldVendor();
      expect(await control().openHoldsFor(vendorNo)).toEqual([
        {
          holdId,
          differingFields: ["bankAccountNo", "swiftCode", "iban"],
          openedAt: expect.any(Date) as Date,
          blockedReason: null,
        },
      ]);
      expect(await control().openHoldsFor(nextVendor())).toEqual([]);
    });
  });

  describe("clearing a hold", () => {
    it("clears the hold only with Finance and a second approver", async () => {
      const { vendorNo, holdId } = await heldVendor();
      await withFinancePaying(async () => {
        expect((await verify("finance", holdId)).status).toBe(200);
        // One person's verification is not enough to pay.
        expect((await pay("finance2", vendorNo)).status).toBe(403);
        await expectRule("bank-detail-hold");

        expect((await clear("approver", holdId)).status).toBe(200);
        expect((await pay("finance2", vendorNo)).status).toBe(200);
      });
      expect(await holdSeenBy("finance", holdId)).toMatchObject({
        status: "cleared",
        resolution: "accept-new-details",
        clearedByUserId: id("approver"),
      });
      expect(await control().openHoldsFor(vendorNo)).toEqual([]);

      // The accepted details are now the stored ones, and the old ones differ.
      expect(await reportPi(vendorNo, CHANGED)).toEqual({ outcome: "match" });
      expect(await reportPi(vendorNo, RECORD)).toMatchObject({
        outcome: "held",
      });
    });

    it("refuses the second approver being the person who changed the details or the first one", async () => {
      // Whoever changed the details cannot verify them.
      const changedByFinance = await heldVendor("finance");
      expect((await verify("finance", changedByFinance.holdId)).status).toBe(
        403,
      );
      await expectRule("segregation-of-duties");
      expect(
        (await holdSeenBy("finance2", changedByFinance.holdId)).verifications,
      ).toEqual([]);

      // Whoever changed the details cannot clear them.
      const changedByApprover = await heldVendor("approver");
      expect((await verify("finance", changedByApprover.holdId)).status).toBe(
        200,
      );
      expect((await clear("approver", changedByApprover.holdId)).status).toBe(
        403,
      );
      await expectRule("segregation-of-duties");

      // One person cannot do both, even holding both permissions.
      const oneAlone = await heldVendor();
      await withGrant("FINANCE", "approvals.decide", async () => {
        expect((await verify("finance", oneAlone.holdId)).status).toBe(200);
        expect((await clear("finance", oneAlone.holdId)).status).toBe(403);
        await expectRule("segregation-of-duties");
        expect((await clear("finance2", oneAlone.holdId)).status).toBe(200);
      });
    });

    it("refuses a clearance before any verification", async () => {
      const { holdId } = await heldVendor();
      expect((await clear("approver", holdId)).status).toBe(403);
      await expectRule("hold-verification");
    });

    it("refuses a confirmation whose contact came from the new document, and records nothing", async () => {
      const { holdId } = await heldVendor();
      const res = await verify("finance", holdId, {
        contactFromStoredRecord: false,
      });
      expect(res.status).toBe(403);
      await expectRule("hold-verification");
      expect((await lastRefusal())?.changes?.reason).toContain("stored record");
      expect((await holdSeenBy("finance", holdId)).verifications).toEqual([]);
    });

    it("refuses a contact in the future", async () => {
      const { holdId } = await heldVendor();
      const res = await verify("finance", holdId, {
        contactedAt: new Date(Date.now() + 3_600_000).toISOString(),
      });
      expect(res.status).toBe(403);
      await expectRule("hold-verification");
    });

    it("keeps the hold after a rejected verification, and records why", async () => {
      const { vendorNo, holdId } = await heldVendor();
      const why = "The vendor says it did not change its account.";
      expect(
        (await verify("finance", holdId, { outcome: "rejected", reason: why }))
          .status,
      ).toBe(200);

      const hold = await holdSeenBy("finance", holdId);
      expect(hold.status).toBe("open");
      expect(hold.verifications).toMatchObject([
        {
          outcome: "rejected",
          verifiedByUserId: id("finance"),
          note: { value: why },
        },
      ]);
      await withFinancePaying(async () => {
        expect((await pay("finance2", vendorNo)).status).toBe(403);
      });
      expect((await clear("approver", holdId)).status).toBe(403);
      await expectRule("hold-verification");

      // A later confirmation, from someone else, can still move it on.
      expect((await verify("finance2", holdId)).status).toBe(200);
      expect((await clear("approver", holdId)).status).toBe(200);
    });

    it("closes a hold as suspected fraud with two people, and keeps the stored details", async () => {
      const { vendorNo, holdId } = await heldVendor();
      expect(
        (await verify("finance", holdId, { outcome: "rejected" })).status,
      ).toBe(200);
      const res = await clear("approver", holdId, {
        resolution: "keep-stored-details",
        reason: "The vendor denies the change, so the PI is not genuine.",
      });
      expect(res.status).toBe(200);
      expect(await holdSeenBy("finance", holdId)).toMatchObject({
        status: "cleared",
        resolution: "keep-stored-details",
      });

      const [event] = await events(
        "governance.bank-hold.details-rejected",
        holdId,
      );
      expect(event?.summary).toContain("suspected fraud: details rejected");
      expect(event?.changes).toMatchObject({
        finding: "suspected fraud: details rejected",
        resolution: "keep-stored-details",
      });
      expect(await events("governance.bank-hold.cleared", holdId)).toEqual([]);

      await withFinancePaying(async () => {
        expect((await pay("finance2", vendorNo)).status).toBe(200);
      });
      // The stored details stand, so the forged ones are still a difference.
      expect(await reportPi(vendorNo, RECORD)).toEqual({ outcome: "match" });
      expect(await reportPi(vendorNo, CHANGED)).toMatchObject({
        outcome: "held",
      });
    });

    it("keeps the two people apart when closing as suspected fraud too", async () => {
      const { holdId } = await heldVendor();
      const keep = { resolution: "keep-stored-details" };
      await withGrant("FINANCE", "approvals.decide", async () => {
        expect(
          (await verify("finance", holdId, { outcome: "rejected" })).status,
        ).toBe(200);
        expect((await clear("finance", holdId, keep)).status).toBe(403);
        await expectRule("segregation-of-duties");
      });
    });

    it("refuses a resolution the latest verification does not support", async () => {
      const confirmed = await heldVendor();
      expect((await verify("finance", confirmed.holdId)).status).toBe(200);
      expect(
        (
          await clear("approver", confirmed.holdId, {
            resolution: "keep-stored-details",
          })
        ).status,
      ).toBe(403);
      await expectRule("hold-verification");
    });

    it("refuses every role without the right by a direct call, and audits it", async () => {
      const { holdId } = await heldVendor();
      const refusals = async () =>
        (await events("auth.permission.refused")).length;
      for (const [step, permission, holders] of [
        [verify, "payments.confirm", ["FINANCE"]],
        // Management is meant to be able to be the second approver.
        [clear, "approvals.decide", ["APPROVER", "MANAGEMENT"]],
      ] as const) {
        const holds = (role: Role) =>
          DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
        // Pinned, or a role wrongly granted the right would leave the loop below.
        expect(ROLES.filter(holds), permission).toEqual(holders);
        for (const role of ROLES.filter((other) => !holds(other))) {
          sessions.set(role, await demoSignIn(t, role));
          const before = await refusals();
          const res = await step(role, holdId);
          expect(res.status, role).toBe(403);
          expect(errorEnvelopeSchema.parse(res.body).error.code, role).toBe(
            "FORBIDDEN",
          );
          expect(await refusals(), role).toBe(before + 1);
        }
      }
    });

    it("lets only one of two racing clearances through", async () => {
      const { holdId } = await heldVendor();
      expect((await verify("finance", holdId)).status).toBe(200);
      const results = await Promise.all([
        clear("approver", holdId),
        clear("approver2", holdId),
      ]);
      expect(results.filter((res) => res.status === 200)).toHaveLength(1);
      expect(await events("governance.bank-hold.cleared", holdId)).toHaveLength(
        1,
      );
    });

    it("refuses clearing a hold that is already closed", async () => {
      const { holdId } = await heldVendor();
      expect((await verify("finance", holdId)).status).toBe(200);
      expect((await clear("approver", holdId)).status).toBe(200);
      expect((await clear("approver2", holdId)).status).toBe(403);
      await expectRule("hold-verification");
      expect((await verify("finance2", holdId)).status).toBe(403);
      await expectRule("hold-verification");
    });

    it("keeps whoever changed the details barred from paying that vendor, from its own record", async () => {
      const { vendorNo, holdId } = await heldVendor("finance");
      expect((await verify("finance2", holdId)).status).toBe(200);
      expect((await clear("approver", holdId)).status).toBe(200);
      // A caller naming someone else as the changer changes nothing.
      const claim = { "vendor-bank.change": id("finance2") };
      await withFinancePaying(async () => {
        const res = await pay(
          "finance",
          vendorNo,
          "vendor-payment.release",
          claim,
        );
        expect(res.status).toBe(403);
        await expectRule("segregation-of-duties");
        expect(
          (await pay("finance2", vendorNo, "vendor-payment.release", claim))
            .status,
        ).toBe(200);
      });
    });

    it("shows why a hold cannot move when only the person who changed it could verify it", async () => {
      const { vendorNo, holdId } = await heldVendor("finance");
      expect((await holdSeenBy("finance", holdId)).blockedReason).toBeNull();
      const users = t.app.get(UserRepository);
      await users.setDisabledAt(id("finance2"), new Date());
      try {
        expect((await holdSeenBy("finance", holdId)).blockedReason).toBe(
          "needs a different Finance user",
        );
        expect(await control().openHoldsFor(vendorNo)).toMatchObject([
          { blockedReason: "needs a different Finance user" },
        ]);
        const list = await call(
          t,
          as("finance"),
          "get",
          `${HOLDS}?status=open&vendorNo=${vendorNo}`,
        );
        expect(
          bankHoldListResponseSchema.parse(list.body).data[0]?.blockedReason,
        ).toBe("needs a different Finance user");
      } finally {
        await users.setDisabledAt(id("finance2"), null);
      }
      expect((await holdSeenBy("finance", holdId)).blockedReason).toBeNull();
    });

    it("refuses a reason with an account number in it, without repeating it", async () => {
      const { holdId } = await heldVendor();
      for (const step of [
        () => verify("finance", holdId, { reason: `Called: ${CHANGED.iban}` }),
        () =>
          clear("approver", holdId, {
            reason: `Accepted ${CHANGED.bankAccountNo} today`,
          }),
      ]) {
        const res = await step();
        expect(res.status).toBe(400);
        expect(errorEnvelopeSchema.parse(res.body).error.details).toMatchObject(
          [{ path: "reason" }],
        );
        expect(res.text).not.toContain(CHANGED.iban);
        expect(res.text).not.toContain(CHANGED.bankAccountNo);
        // Audited like any refusal, and the row does not repeat it either.
        await expectRule("hold-reason");
        const refusal = JSON.stringify(await lastRefusal());
        expect(refusal).toContain(holdId);
        expect(refusal).not.toContain(CHANGED.iban);
        expect(refusal).not.toContain(CHANGED.bankAccountNo);
      }
    });

    describe.each([
      { label: "empty", body: { reason: "" } },
      { label: "only spaces", body: { reason: "   " } },
      { label: "missing", body: { reason: undefined } },
    ])("a reason that is $label", ({ body }) => {
      const expectRefusedAndAudited = async (
        res: request.Response,
        refused: { action: string; who: string; hold: HeldVendor },
      ) => {
        expect(res.status).toBe(400);
        expect(errorEnvelopeSchema.parse(res.body).error).toMatchObject({
          code: "VALIDATION_FAILED",
          details: [{ path: "reason" }],
        });
        expect(await lastRefusal()).toMatchObject({
          actor: { kind: "user", userId: id(refused.who) },
          entityType: "VendorBankHold",
          entityId: refused.hold.holdId,
          changes: {
            action: refused.action,
            rule: "hold-reason",
            vendorNo: refused.hold.vendorNo,
            holdIds: [refused.hold.holdId],
          },
        });
      };

      it("is refused on the verification route, saves nothing and is audited", async () => {
        const hold = await heldVendor();
        await expectRefusedAndAudited(
          await verify("finance", hold.holdId, body),
          { action: "payment-hold.verify", who: "finance", hold },
        );
        expect(
          (await holdSeenBy("finance", hold.holdId)).verifications,
        ).toEqual([]);
      });

      it("is refused on the clearance route, keeps the hold open and is audited", async () => {
        const hold = await heldVendor();
        expect((await verify("finance", hold.holdId)).status).toBe(200);
        await expectRefusedAndAudited(
          await clear("approver", hold.holdId, body),
          { action: "payment-hold.clear", who: "approver", hold },
        );
        expect(await holdSeenBy("finance", hold.holdId)).toMatchObject({
          status: "open",
          clearReason: null,
        });
      });
    });

    it("takes who verified from the session, and refuses a body that names them", async () => {
      const { holdId } = await heldVendor();
      const res = await verify("finance", holdId, {
        verifiedByUserId: id("finance2"),
      });
      expect(res.status).toBe(400);
      expect((await holdSeenBy("finance", holdId)).verifications).toEqual([]);
      expect((await verify("finance", holdId)).status).toBe(200);
      expect((await holdSeenBy("finance", holdId)).verifications).toMatchObject(
        [{ verifiedByUserId: id("finance") }],
      );
    });

    it("answers 404 for a hold that does not exist, and 400 for a bad id", async () => {
      const unknown = "00000000-0000-7000-8000-00000000dead";
      expect((await view("finance", unknown)).status).toBe(404);
      expect((await verify("finance", unknown)).status).toBe(404);
      expect((await clear("approver", unknown)).status).toBe(404);
      expect((await view("finance", "not-a-uuid")).status).toBe(400);
    });

    it("lists holds a page at a time, by status and vendor", async () => {
      const { vendorNo, holdId } = await heldVendor();
      const res = await call(
        t,
        as("finance"),
        "get",
        `${HOLDS}?status=open&vendorNo=${vendorNo}&page=1&pageSize=10`,
      );
      expect(res.status).toBe(200);
      const page = bankHoldListResponseSchema.parse(res.body);
      expect(page.data.map((hold) => hold.id)).toEqual([holdId]);
      expect(page.meta).toEqual({ page: 1, pageSize: 10, total: 1 });
      const none = await call(
        t,
        as("finance"),
        "get",
        `${HOLDS}?status=cleared&vendorNo=${vendorNo}`,
      );
      expect(bankHoldListResponseSchema.parse(none.body).data).toEqual([]);
    });
  });

  describe("what the trail and the screens show", () => {
    it("audits the hold, the verification and the clearance, masked to the last four", async () => {
      const { vendorNo, holdId } = await heldVendor();
      expect((await verify("finance", holdId)).status).toBe(200);
      expect((await clear("approver", holdId)).status).toBe(200);

      const beforeAndAfter = {
        bankAccountNo: { from: "****9901", to: "****7702" },
        swiftCode: { from: "****ZZ00", to: "****ZZ77" },
        iban: { from: "****9901", to: "****7702" },
      };
      expect(
        (await events("governance.bank-hold.opened", holdId))[0],
      ).toMatchObject({
        actor: BY_THE_TEST.actor,
        entityType: "VendorBankHold",
        changes: {
          vendorNo,
          source: "vendor-pi",
          sourceRef: "PI-F5-1",
          changedByUserId: id("support"),
          differingFields: ["bankAccountNo", "swiftCode", "iban"],
          ...beforeAndAfter,
        },
      });
      expect(
        (await events("governance.bank-hold.verification-recorded", holdId))[0],
      ).toMatchObject({
        actor: { kind: "user", userId: id("finance"), role: "FINANCE" },
        changes: {
          vendorNo,
          outcome: "confirmed",
          contactFromStoredRecord: true,
          reason: STORED_CONTACT,
        },
      });
      expect(
        (await events("governance.bank-hold.cleared", holdId))[0],
      ).toMatchObject({
        actor: { kind: "user", userId: id("approver"), role: "APPROVER" },
        changes: {
          vendorNo,
          resolution: "accept-new-details",
          verifiedByUserId: id("finance"),
          ...beforeAndAfter,
        },
      });
    });

    it("masks bank details by role with a reason, and still shows which field differs", async () => {
      const { holdId } = await heldVendor();
      expect((await verify("finance", holdId)).status).toBe(200);
      for (const who of ["finance", "approver", "auditor"]) {
        const hold = await holdSeenBy(who, holdId);
        expect(hold.fields[0], who).toMatchObject({
          field: "bankAccountNo",
          differs: true,
          before: { masked: false, value: "****9901" },
          after: { masked: false, value: "****7702" },
        });
      }
      const hold = await holdSeenBy("warehouse", holdId);
      expect(hold.differingFields).toEqual([
        "bankAccountNo",
        "swiftCode",
        "iban",
      ]);
      for (const field of hold.fields) {
        expect(field.before, field.field).toMatchObject({
          masked: true,
          value: null,
          reason: "bankDetails",
        });
        expect(field.after, field.field).toMatchObject({
          masked: true,
          value: null,
          reason: "bankDetails",
        });
      }
      expect(hold.verifications[0]?.note).toMatchObject({
        masked: true,
        value: null,
        reason: "bankDetails",
      });
    });

    it.each([
      {
        resolution: "accept-new-details",
        outcome: "confirmed",
        event: "governance.bank-hold.cleared",
      },
      {
        resolution: "keep-stored-details",
        outcome: "rejected",
        event: "governance.bank-hold.details-rejected",
      },
    ])(
      "saves, masks and audits the second person's reason when closing with $resolution",
      async ({ resolution, outcome, event }) => {
        const { vendorNo, holdId } = await heldVendor();
        expect((await verify("finance", holdId, { outcome })).status).toBe(200);
        const why = "Checked against the verification on this hold.";
        expect(
          (await clear("approver", holdId, { resolution, reason: why })).status,
        ).toBe(200);

        expect((await holdSeenBy("finance", holdId)).clearReason).toMatchObject(
          { masked: false, value: why },
        );
        expect(
          (await holdSeenBy("warehouse", holdId)).clearReason,
        ).toMatchObject({ masked: true, value: null, reason: "bankDetails" });
        expect((await events(event, holdId))[0]).toMatchObject({
          actor: { kind: "user", userId: id("approver"), role: "APPROVER" },
          changes: { vendorNo, resolution, reason: why },
        });
      },
    );

    it("shows the last four in the audit viewer to the auditor only", async () => {
      const { holdId } = await heldVendor();
      const changesSeenBy = async (who: string) => {
        const res = await call(
          t,
          as(who),
          "get",
          `${API}/audit/events?entityType=VendorBankHold&entityId=${holdId}`,
        );
        expect(res.status, who).toBe(200);
        const body = z
          .object({ data: z.array(auditEventViewSchema) })
          .parse(res.body);
        return body.data[0]?.changes.find(
          (change) => change.field === "bankAccountNo",
        );
      };
      expect(await changesSeenBy("auditor")).toMatchObject({
        masked: false,
        change: true,
        before: "****9901",
        after: "****7702",
      });
      expect(await changesSeenBy("admin")).toMatchObject({
        masked: true,
        reason: "bankDetails",
        before: null,
        after: null,
      });
    });

    it("never lets a full number reach a response, an audit row, a table or a log", async () => {
      const before = {
        bankAccountNo: "000000004411",
        swiftCode: "DEMOZZ44",
        iban: "ZZ00DEMO0000000004411",
      };
      const after = {
        bankAccountNo: "000000006622",
        swiftCode: "DEMOZZ66",
        iban: "ZZ00DEMO0000000006622",
      };
      const vendorNo = nextVendor();
      await setBaseline(vendorNo, before);
      const report = await reportPi(vendorNo, after, "finance");
      if (report.outcome !== "held") throw new Error("expected a hold");
      const { holdId } = report;

      const responses = [
        await verify("finance", holdId),
        await verify("warehouse", holdId),
        await verify("finance2", holdId, { contactFromStoredRecord: false }),
        await verify("finance2", holdId),
        await clear("finance2", holdId),
        await view("finance", holdId),
        await view("warehouse", holdId),
        await call(t, as("finance"), "get", `${HOLDS}?vendorNo=${vendorNo}`),
      ];
      await withFinancePaying(async () => {
        responses.push(await pay("finance2", vendorNo));
      });
      responses.push(await clear("approver", holdId));
      await withFinancePaying(async () => {
        responses.push(await pay("finance2", vendorNo));
      });
      responses.push(
        await call(
          t,
          as("auditor"),
          "get",
          `${API}/audit/events?entityType=VendorBankHold&entityId=${holdId}`,
        ),
      );

      const database = t.app.get(Database).client;
      const tables = await Promise.all([
        database.$queryRaw`SELECT row_to_json(r) AS row FROM "VendorBankBaseline" r`,
        database.$queryRaw`SELECT row_to_json(r) AS row FROM "VendorBankHold" r`,
        database.$queryRaw`SELECT row_to_json(r) AS row FROM "VendorBankHoldVerification" r`,
      ]);
      expect(t.logLines().length).toBeGreaterThan(0);
      const everywhere = [
        ...responses.map((res) => res.text),
        JSON.stringify(await auditEvents(t)),
        JSON.stringify(tables),
        JSON.stringify(t.logLines()),
      ];
      expect(everywhere.join()).toContain(holdId);
      for (const secret of [
        ...Object.values(before),
        ...Object.values(after),
      ]) {
        for (const text of everywhere) {
          expect(text.includes(secret), secret).toBe(false);
        }
      }
    });
  });

  describe("the stored details", () => {
    it("records each vendor's stored details once, from the record, and never overwrites them", async () => {
      const handedOver = vi.spyOn(control(), "recordBaseline");
      await seedVendorBankBaselines(t.app);
      const numbers = handedOver.mock.calls.map(
        ([{ details }]) => details.bankAccountNo,
      );
      handedOver.mockRestore();
      const synthetic = syntheticDataset().vendorBankAccounts;
      expect(numbers).toHaveLength(synthetic.length);
      // Obviously fake: ten zeros, then the vendor's own two digits.
      for (const number of numbers) expect(number).toMatch(/^0{10}\d{2}$/);

      const [first] = synthetic;
      if (!first) throw new Error("no synthetic bank account");
      expect(await reportPi(first.vendorNo, first)).toEqual({
        outcome: "match",
      });
      const count = (await auditEvents(t)).length;
      await seedVendorBankBaselines(t.app);
      expect((await auditEvents(t)).length).toBe(count);
    });

    it("keeps the first stored details when asked to record them again", async () => {
      const vendorNo = nextVendor();
      expect(await setBaseline(vendorNo, RECORD)).toBe(true);
      expect(await setBaseline(vendorNo, CHANGED)).toBe(false);
      expect(await reportPi(vendorNo, RECORD)).toEqual({ outcome: "match" });
    });
  });

  // No domain event bus exists yet (P-15). The audited half is tested above.
  it.todo("emits payment.held and payment.hold-cleared, both audited");
});

describe("the bank-detail hold with no fingerprint key (F-5)", () => {
  let t: TestApp;
  // Obviously fake: ZZ is not a country, and the bank names itself a demo.
  const DETAILS = {
    bankAccountNo: "000000008801",
    swiftCode: "DEMOZZ88",
    iban: "ZZ00DEMO0000000008801",
  };
  const control = () => t.app.get(BankDetailHoldService);
  const report = (vendorNo: string) =>
    control().reportDetails(
      {
        vendorNo,
        details: DETAILS,
        source: "vendor-pi",
        sourceRef: "PI-NO-KEY-1",
        changedByUserId: null,
      },
      BY_THE_TEST,
    );

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp();
  });
  afterAll(async () => {
    await t.close();
  });

  it("has no key when the configuration has none", () => {
    expect(t.app.get(BankFingerprinter).configured).toBe(false);
  });

  it("logs one clear warning at startup", () => {
    expect(keyWarnings(t)).toMatchObject([
      {
        level: 40,
        msg: "BANK_FINGERPRINT_KEY is not set: bank-detail comparisons will fail closed and every vendor change will be held.",
      },
    ]);
  });

  it("holds every report, since nothing can be compared", async () => {
    const vendorNo = "V-NO-KEY-1";
    expect(await report(vendorNo)).toMatchObject({ outcome: "held" });
    expect(await report(vendorNo)).toMatchObject({ outcome: "held" });
    expect((await control().openHoldsFor(vendorNo)).length).toBeGreaterThan(0);
  });

  it("stores nothing it could never compare with again", async () => {
    const vendorNo = "V-NO-KEY-2";
    expect(
      await control().recordBaseline(
        { vendorNo, accountCode: "MAIN", details: DETAILS },
        BY_THE_TEST,
      ),
    ).toBe(false);
    expect(await t.app.get(BankHoldRepository).baselinesFor(vendorNo)).toEqual(
      [],
    );
    expect(await report(vendorNo)).toMatchObject({ outcome: "held" });
  });

  it("never matches details stored while there was no key", async () => {
    const vendorNo = "V-NO-KEY-4";
    await t.app
      .get(BankHoldRepository)
      .saveBaseline(
        vendorNo,
        "MAIN",
        BankDetails.from(DETAILS).seal(new BankFingerprinter(null)),
        "a-hold-cleared-with-no-key",
      );
    expect(await report(vendorNo)).toMatchObject({ outcome: "held" });
  });

  it("skips storing the vendors' details from the seed", async () => {
    expect(await seedVendorBankBaselines(t.app)).toContain(
      "BANK_FINGERPRINT_KEY",
    );
  });

  it("keeps the numbers out of the audit trail all the same", async () => {
    await report("V-NO-KEY-3");
    const trail = JSON.stringify(await auditEvents(t));
    expect(trail).toContain("****8801");
    for (const secret of Object.values(DETAILS)) {
      expect(trail.includes(secret), secret).toBe(false);
    }
  });
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

describe("the approver group, with APPROVER_GROUP on (#252)", () => {
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
  // Two more approvers, made only in the test database: the demo seed has one.
  const MORE_APPROVERS = [
    ["second", "approver.group.second@example.test", "Bea Second"],
    ["third", "approver.group.third@example.test", "Cyd Third"],
  ] as const;

  beforeAll(async () => {
    await resetTestData();
    // The group decides; its limits stay as they are by default: off.
    t = await createTestApp(
      { APPROVER_GROUP: "on" },
      [StandInApprovalController, StandInRouteController],
      (builder) =>
        builder
          .overrideProvider(PermissionPolicy)
          .useClass(GovernancePermissionPolicy),
    );
    const users = t.app.get(UserRepository);
    const hasher = t.app.get(PasswordHasher);
    for (const [who, role] of [
      ["requester", "PRODUCT_MANAGER"],
      ["first", "APPROVER"],
      ["management", "MANAGEMENT"],
      ["support", "SUPPORT"],
      ["warehouse", "WAREHOUSE"],
    ] as const) {
      const user = await users.findByEmail(await emailForRole(role));
      if (!user) throw new Error(`no demo user for ${role}`);
      ids.set(who, user.id);
      sessions.set(who, await demoSignIn(t, role));
    }
    for (const [who, email, name] of MORE_APPROVERS) {
      const user = await users.create({
        email,
        displayName: name,
        role: "APPROVER",
        passwordHash: await hasher.hash(TEST_DEMO_PASSWORD),
      });
      ids.set(who, user.id);
      sessions.set(who, await passwordSignIn(t, email));
    }
  });
  afterAll(async () => {
    await t.close();
  });

  const approveSpr = (
    who: string,
    recordNo: string,
    body: Record<string, unknown> = {},
  ) =>
    call(t, as(who), "post", STAND_IN(recordNo), {
      csrf: true,
      body: {
        action: "spr.approve",
        amount: "100.00",
        requesterUserId: id("requester"),
        ...body,
      },
    });
  const route = (who: string, recordNo: string) =>
    call(t, as(who), "post", `${API}/test-only/sprs/${recordNo}/route`, {
      csrf: true,
      body: { requesterUserId: id("requester") },
    });
  const lastRefusal = async () =>
    (await auditEvents(t))
      .filter((event) => event.action === "governance.policy.refused")
      .at(-1);
  const approversFor = (requester: string, amount = "100.00") =>
    t.app.get(AuthorisationService).approversFor({
      requester: id(requester),
      action: "spr.approve",
      amount,
    });
  const whileDisabled = async (who: string[], work: () => Promise<void>) => {
    const users = t.app.get(UserRepository);
    for (const each of who) await users.setDisabledAt(id(each), new Date());
    try {
      await work();
    } finally {
      for (const each of who) await users.setDisabledAt(id(each), null);
    }
  };

  describe("any one of the approvers decides", () => {
    it("lets each of the three approvers decide", async () => {
      for (const [n, who] of ["first", "second", "third"].entries()) {
        expect(
          (await approveSpr(who, `SPR-GROUP-000${String(n + 1)}`)).status,
          who,
        ).toBe(200);
      }
    });

    it("never lets the requester decide, even when they are an approver", async () => {
      const raised = { requesterUserId: id("second") };
      expect(
        (await approveSpr("second", "SPR-GROUP-0004", raised)).status,
      ).toBe(403);
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "no-self-approval",
      });
      expect((await approveSpr("third", "SPR-GROUP-0004", raised)).status).toBe(
        200,
      );
    });

    it("leaves Management out while limits are off, and says why in the trail (ADR 0055)", async () => {
      expect((await approveSpr("management", "SPR-GROUP-0005")).status).toBe(
        403,
      );
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "approval-route",
        reason:
          "only a management approver who did not raise the request may decide it",
      });
    });

    it("applies no limit while limits are off", async () => {
      const huge = { amount: "999999999.99" };
      expect((await approveSpr("first", "SPR-GROUP-0006", huge)).status).toBe(
        200,
      );
    });
  });

  describe("approversFor, for area 2 to route an SPR", () => {
    it("names every enabled approver except the requester, by id and name only, sorted by name", async () => {
      const group = await approversFor("requester");
      expect(group.reason).toBeNull();
      expect(group.approvers.map((each) => each.userId).sort()).toEqual(
        [id("first"), id("second"), id("third")].sort(),
      );
      const names = group.approvers.map((each) => each.displayName);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
      for (const approver of group.approvers) {
        expect(Object.keys(approver).sort()).toEqual(["displayName", "userId"]);
      }
      expect(JSON.stringify(group)).not.toContain("@");
    });

    it("leaves out the requester and a disabled approver", async () => {
      await whileDisabled(["third"], async () => {
        const group = await approversFor("second");
        expect(group.approvers.map((each) => each.userId)).toEqual([
          id("first"),
        ]);
      });
    });

    it("gives a reason only when nobody is left", async () => {
      await whileDisabled(["second", "third"], async () => {
        expect(await approversFor("first")).toEqual({
          approvers: [],
          reason: "the only enabled management approver raised the request",
        });
      });
    });
  });

  describe("the coordinator routes, and never approves", () => {
    it("lets Support route an SPR", async () => {
      expect((await route("support", "SPR-GROUP-0010")).status).toBe(200);
    });

    it("refuses a role without spr.route at the guard, and audits the refusal", async () => {
      expect((await route("warehouse", "SPR-GROUP-0011")).status).toBe(403);
      const refusal = (await auditEvents(t))
        .filter((event) => event.action === "auth.permission.refused")
        .at(-1);
      expect(refusal?.changes).toMatchObject({ permission: "spr.route" });
    });

    it("refuses the coordinator the approval itself, at the guard", async () => {
      expect((await approveSpr("support", "SPR-GROUP-0012")).status).toBe(403);
      // The guard refuses, before the policy: Support never holds approvals.decide.
      const refusal = (await auditEvents(t))
        .filter((event) => event.action === "auth.permission.refused")
        .at(-1);
      expect(refusal?.changes).toMatchObject({
        permission: "approvals.decide",
      });
      expect(refusal?.actor).toMatchObject({ userId: id("support") });
    });

    it("refuses an approver the approval of an SPR they routed, and lets another approver decide it", async () => {
      const routed = { earlierDuties: { "spr.route": id("first") } };
      expect((await approveSpr("first", "SPR-GROUP-0013", routed)).status).toBe(
        403,
      );
      expect((await lastRefusal())?.changes).toMatchObject({
        rule: "segregation-of-duties",
      });
      expect(
        (await approveSpr("second", "SPR-GROUP-0013", routed)).status,
      ).toBe(200);
    });
  });
});

describe("the approver group with its limits on (#252)", () => {
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
  /** A purchase limit for one approver, saved as an approval setup. */
  const limitOf = async (who: string, limit: Partial<ApprovalSetup>) =>
    t.app.get(ApprovalSetupService).save(
      {
        userId: id(who),
        approverId: null,
        salesAmountApprovalLimit: "0.00",
        purchaseAmountApprovalLimit: "0.00",
        unlimitedSalesApproval: false,
        unlimitedPurchaseApproval: false,
        substituteUserId: null,
        awayFrom: null,
        awayUntil: null,
        ...limit,
      },
      BY_THE_TEST,
    );

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp(
      { APPROVER_GROUP: "on", APPROVAL_LIMITS: "on" },
      [StandInApprovalController],
      (builder) =>
        builder
          .overrideProvider(PermissionPolicy)
          .useClass(GovernancePermissionPolicy),
    );
    const users = t.app.get(UserRepository);
    const hasher = t.app.get(PasswordHasher);
    for (const [who, role] of [
      ["requester", "PRODUCT_MANAGER"],
      ["first", "APPROVER"],
    ] as const) {
      const user = await users.findByEmail(await emailForRole(role));
      if (!user) throw new Error(`no demo user for ${role}`);
      ids.set(who, user.id);
      sessions.set(who, await demoSignIn(t, role));
    }
    for (const [who, email, name] of [
      ["second", "approver.limits.second@example.test", "Bea Second"],
      ["third", "approver.limits.third@example.test", "Cyd Third"],
    ] as const) {
      const user = await users.create({
        email,
        displayName: name,
        role: "APPROVER",
        passwordHash: await hasher.hash(TEST_DEMO_PASSWORD),
      });
      ids.set(who, user.id);
      sessions.set(who, await passwordSignIn(t, email));
    }
    await limitOf("first", { purchaseAmountApprovalLimit: "5000.00" });
    await limitOf("second", { purchaseAmountApprovalLimit: "3000.00" });
    await limitOf("third", { unlimitedPurchaseApproval: true });
  });
  afterAll(async () => {
    await t.close();
  });

  const approversFor = (amount: string) =>
    t.app.get(AuthorisationService).approversFor({
      requester: id("requester"),
      action: "spr.approve",
      amount,
    });
  const covering = async (amount: string) =>
    (await approversFor(amount)).approvers.map((each) => each.userId).sort();

  it("names only the approvers whose limit covers the amount", async () => {
    expect(await covering("2000.00")).toEqual(
      [id("first"), id("second"), id("third")].sort(),
    );
    expect(await covering("4000.00")).toEqual(
      [id("first"), id("third")].sort(),
    );
    expect(await covering("9000.00")).toEqual([id("third")]);
  });

  it("says the amount is over every limit when nobody's covers it", async () => {
    const users = t.app.get(UserRepository);
    await users.setDisabledAt(id("third"), new Date());
    try {
      expect(await approversFor("9000.00")).toEqual({
        approvers: [],
        reason: "the amount is over every approver's purchase approval limit",
      });
    } finally {
      await users.setDisabledAt(id("third"), null);
    }
  });

  it("refuses an approver above their own limit by the limit rule, and lets one whose limit covers it decide", async () => {
    const approve = (who: string) =>
      call(t, as(who), "post", STAND_IN("SPR-LIMITS-0001"), {
        csrf: true,
        body: {
          action: "spr.approve",
          amount: "4000.00",
          requesterUserId: id("requester"),
        },
      });
    expect((await approve("second")).status).toBe(403);
    const refusal = (await auditEvents(t))
      .filter((event) => event.action === "governance.policy.refused")
      .at(-1);
    expect(refusal?.changes).toMatchObject({ rule: "approval-limit" });
    expect((await approve("first")).status).toBe(200);
  });
});
