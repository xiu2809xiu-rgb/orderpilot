import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { orderStatusSchema } from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { describe, expect, it, vi } from "vitest";
import type { AuditInput, AuditService } from "../../audit/audit.service.js";
import { DomainError } from "../../common/domain-error.js";
import type { Database } from "../../database/database.js";
import type { AuthorisationService } from "../governance/authorisation.service.js";
import {
  DEFAULT_ORDER_FLOW_RULES,
  type OrderActor,
  type OrderFlowRules,
  type OrderSnapshot,
} from "./domain/order-state-machine.js";
import type {
  OrderWorkflowRepository,
  StoredOrder,
} from "./order-workflow.repository.js";
import { OrderWorkflowService } from "./order-workflow.service.js";

const AT = new Date("2026-11-06T02:00:00.000Z");
const INFO = { ip: "203.0.113.9", traceId: "trace-1" };
const APPROVER_ID = "0198f000-0000-7000-8000-000000000001";
const REQUESTER_ID = "0198f000-0000-7000-8000-000000000002";

const approver: OrderActor = {
  kind: "user",
  userId: APPROVER_ID,
  name: "Test Approver",
  role: "APPROVER",
};
const warehouse: OrderActor = {
  kind: "user",
  userId: APPROVER_ID,
  name: "Test Warehouse",
  role: "WAREHOUSE",
};

function warehouseOrSupport(role: "SUPPORT" | "WAREHOUSE"): OrderActor {
  return { kind: "user", userId: APPROVER_ID, name: `Test ${role}`, role };
}

const SPR = {
  recordNo: "SPR-20261106-0001",
  amount: "1200.00",
  requesterUserId: REQUESTER_ID,
};

function state(changes: Partial<OrderSnapshot> = {}): OrderSnapshot {
  return {
    status: "AwaitingSpr",
    prepaymentDue: null,
    stockCoversOrder: false,
    holds: [],
    resumeTo: null,
    enteredAt: AT.toISOString(),
    ...changes,
  };
}

function refusal(error: unknown): DomainError {
  if (error instanceof DomainError) return error;
  throw new Error(`Expected a DomainError, got ${String(error)}`);
}

interface Options {
  readonly stored?: StoredOrder | null;
  readonly saved?: boolean;
  readonly policyRefuses?: boolean;
  readonly auditFails?: boolean;
  readonly rules?: OrderFlowRules;
}

/** The service with its neighbours in memory, and a log of the order things happened in. */
function setUp(options: Options = {}) {
  const log: string[] = [];
  const stored =
    options.stored === undefined
      ? { id: "instance-1", version: 3, state: state() }
      : options.stored;
  const audited: AuditInput[] = [];
  let inTransaction = false;

  const repository = {
    find: vi.fn(() => Promise.resolve(stored)),
    insert: vi.fn(() => {
      log.push(`insert, in a transaction: ${String(inTransaction)}`);
      return Promise.resolve();
    }),
    saveTransition: vi.fn(() => {
      log.push(`save, in a transaction: ${String(inTransaction)}`);
      return Promise.resolve(options.saved ?? true);
    }),
  };
  const database = {
    transaction: async <T>(work: () => Promise<T>): Promise<T> => {
      inTransaction = true;
      try {
        return await work();
      } finally {
        inTransaction = false;
      }
    },
  };
  const policy = {
    enforce: vi.fn(() => {
      log.push(`policy, in a transaction: ${String(inTransaction)}`);
      return options.policyRefuses
        ? Promise.reject(new DomainError("FORBIDDEN", "No."))
        : Promise.resolve();
    }),
  };
  const audit = {
    record: vi.fn((input: AuditInput) => {
      if (options.auditFails) return Promise.reject(new Error("audit is down"));
      log.push(`audit ${input.action}`);
      audited.push(input);
      return Promise.resolve();
    }),
  };

  const service = new OrderWorkflowService(
    repository as unknown as OrderWorkflowRepository,
    database as unknown as Database,
    policy as unknown as AuthorisationService,
    audit as unknown as AuditService,
    options.rules ?? DEFAULT_ORDER_FLOW_RULES,
  );
  return { service, repository, policy, audit, audited, log };
}

describe("OrderWorkflowService, applying a transition", () => {
  it("audits a system actor's move as the system", async () => {
    const { service, audited } = setUp({
      stored: {
        id: "instance-1",
        version: 3,
        state: state({ status: "Packing" }),
      },
    });

    await service.apply(
      "SO-0001",
      { type: "HOLD_RAISED", source: "check", reason: "Differs" },
      { kind: "system", name: "checks" },
      INFO,
      AT,
    );

    expect(audited[0]).toMatchObject({
      actor: { kind: "system", name: "checks" },
      changes: {
        reason: "Differs",
        data: { source: "check" },
        from: "Packing",
        to: "OnHold",
      },
    });
  });

  it("saves the next state and audits it, in one transaction", async () => {
    const { service, repository, audited, log } = setUp({
      stored: {
        id: "instance-1",
        version: 3,
        state: state({ status: "Invoiced" }),
      },
    });

    const result = await service.apply(
      "SO-0001",
      { type: "RELEASED" },
      warehouse,
      INFO,
      AT,
    );

    expect(result.state.status).toBe("Released");
    expect(repository.saveTransition).toHaveBeenCalledWith(
      { id: "instance-1", version: 3 },
      "SO-0001",
      result,
    );
    expect(log).toEqual([
      "save, in a transaction: true",
      "audit workflow.transition",
    ]);
    expect(audited[0]).toMatchObject({
      actor: { kind: "user", userId: APPROVER_ID, role: "WAREHOUSE" },
      entityType: "Order",
      entityId: "SO-0001",
      changes: { event: "RELEASED", from: "Invoiced", to: "Released" },
      ip: "203.0.113.9",
      traceId: "trace-1",
    });
  });

  it("answers not found for an order with no workflow, and audits nothing", async () => {
    const { service, audit } = setUp({ stored: null });

    const error = await service
      .apply("SO-9999", { type: "RELEASED" }, warehouse, INFO, AT)
      .catch(refusal);

    expect(refusal(error).code).toBe("NOT_FOUND");
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("refuses an illegal move, audits the refusal and saves nothing", async () => {
    const { service, repository, audited } = setUp({
      stored: {
        id: "instance-1",
        version: 3,
        state: state({ status: "Closed" }),
      },
    });

    const error = await service
      .apply("SO-0001", { type: "RELEASED" }, warehouse, INFO, AT)
      .catch(refusal);

    expect(refusal(error).code).toBe("CONFLICT");
    expect(repository.saveTransition).not.toHaveBeenCalled();
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({
      action: "workflow.transition.refused",
      entityId: "SO-0001",
      changes: { event: "RELEASED", from: "Closed", code: "CONFLICT" },
      traceId: "trace-1",
    });
  });

  it("refuses the wrong role with 403 and audits it", async () => {
    const { service, repository, audited } = setUp({
      stored: {
        id: "instance-1",
        version: 3,
        state: state({ status: "Invoiced" }),
      },
    });

    const error = await service
      .apply("SO-0001", { type: "RELEASED" }, approver, INFO, AT)
      .catch(refusal);

    expect(refusal(error).code).toBe("FORBIDDEN");
    expect(repository.saveTransition).not.toHaveBeenCalled();
    expect(audited[0]?.action).toBe("workflow.transition.refused");
  });

  it("still refuses when the refusal's audit event cannot be written", async () => {
    const { service } = setUp({
      auditFails: true,
      stored: {
        id: "instance-1",
        version: 3,
        state: state({ status: "Closed" }),
      },
    });

    const error = await service
      .apply("SO-0001", { type: "RELEASED" }, warehouse, INFO, AT)
      .catch(refusal);

    expect(refusal(error).code).toBe("CONFLICT");
  });

  it("refuses when someone else moved the order first, and audits that", async () => {
    const { service, audited } = setUp({
      saved: false,
      stored: {
        id: "instance-1",
        version: 3,
        state: state({ status: "Invoiced" }),
      },
    });

    const error = await service
      .apply("SO-0001", { type: "RELEASED" }, warehouse, INFO, AT)
      .catch(refusal);

    expect(refusal(error).code).toBe("CONFLICT");
    expect(audited.map((a) => a.action)).toEqual([
      "workflow.transition.refused",
    ]);
  });

  it("refuses a seeded sample order, which the machine has never run", async () => {
    const { service, repository } = setUp({
      stored: { id: "instance-1", version: 0, state: null },
    });

    const error = await service
      .apply("SO-0001", { type: "RELEASED" }, warehouse, INFO, AT)
      .catch(refusal);

    expect(refusal(error).code).toBe("CONFLICT");
    expect(repository.saveTransition).not.toHaveBeenCalled();
  });

  it("will not take an SPR decision around the policy, even past the type check", async () => {
    const { service, repository, policy } = setUp();

    await expect(
      service.apply(
        "SO-0001",
        { type: "SPR_APPROVED" } as never,
        approver,
        INFO,
        AT,
      ),
    ).rejects.toThrow("decideSpr");
    expect(policy.enforce).not.toHaveBeenCalled();
    expect(repository.saveTransition).not.toHaveBeenCalled();
  });

  it("applies the rules it was given, so a setting changes the flow", async () => {
    const shortfall: StoredOrder = {
      id: "instance-1",
      version: 3,
      state: state({ status: "StockChecked", stockCoversOrder: false }),
    };
    const support = warehouseOrSupport("SUPPORT");

    const strict = await setUp({ stored: shortfall })
      .service.apply("SO-0001", { type: "PI_SENT" }, support, INFO, AT)
      .catch(refusal);
    expect(refusal(strict).code).toBe("CONFLICT");

    const relaxed = await setUp({
      stored: shortfall,
      rules: { sprRequiredOnShortfall: false },
    }).service.apply("SO-0001", { type: "PI_SENT" }, support, INFO, AT);
    expect(relaxed.state.status).toBe("AwaitingPayment");
  });

  it("does not ask area 4's policy about a move it has no action for", async () => {
    const { service, policy } = setUp({
      stored: {
        id: "instance-1",
        version: 3,
        state: state({ status: "Invoiced" }),
      },
    });

    await service.apply("SO-0001", { type: "RELEASED" }, warehouse, INFO, AT);

    expect(policy.enforce).not.toHaveBeenCalled();
  });
});

describe("OrderWorkflowService, starting an order", () => {
  it("saves it and audits it in one transaction", async () => {
    const { service, audited, log } = setUp({ stored: null });

    const result = await service.start(
      "SO-0001",
      { prepaymentDue: "100.00" },
      warehouseOrSupport("SUPPORT"),
      INFO,
      AT,
    );

    expect(result.state.status).toBe("Received");
    expect(log).toEqual([
      "insert, in a transaction: true",
      "audit workflow.started",
    ]);
    expect(audited[0]).toMatchObject({
      actor: { kind: "user", userId: APPROVER_ID, role: "SUPPORT" },
      entityType: "Order",
      entityId: "SO-0001",
      changes: { to: "Received", data: { prepaymentDue: "100.00" } },
    });
  });

  it("audits the system as the actor when the system starts it", async () => {
    const { service, audited } = setUp({ stored: null });

    await service.start(
      "SO-0001",
      { prepaymentDue: null },
      { kind: "system", name: "documents" },
      INFO,
      AT,
    );

    expect(audited[0]?.actor).toEqual({ kind: "system", name: "documents" });
  });

  it("refuses the wrong role, audits it and stores nothing", async () => {
    const { service, repository, audited } = setUp({ stored: null });

    const error = await service
      .start("SO-0001", { prepaymentDue: null }, warehouse, INFO, AT)
      .catch(refusal);

    expect(refusal(error).code).toBe("FORBIDDEN");
    expect(repository.insert).not.toHaveBeenCalled();
    expect(audited[0]).toMatchObject({
      action: "workflow.transition.refused",
      changes: { event: "ORDER_STARTED", from: null, code: "FORBIDDEN" },
      actor: { kind: "user", role: "WAREHOUSE" },
    });
  });
});

describe("OrderWorkflowService, deciding an SPR", () => {
  it("asks area 4's policy before it opens the transaction, with the amount and the requester", async () => {
    const { service, policy, log } = setUp();

    const result = await service.decideSpr(
      "SO-0001",
      { type: "SPR_APPROVED" },
      SPR,
      approver,
      INFO,
      AT,
    );

    expect(result.state.status).toBe("SprApproved");
    expect(policy.enforce).toHaveBeenCalledWith(
      {
        actor: { userId: APPROVER_ID, role: "APPROVER" },
        action: "spr.approve",
        resource: { type: "Spr", id: "SPR-20261106-0001" },
        amount: "1200.00",
        requesterUserId: REQUESTER_ID,
      },
      INFO,
      AT,
    );
    expect(log).toEqual([
      "policy, in a transaction: false",
      "save, in a transaction: true",
      "audit workflow.transition",
    ]);
  });

  it("asks the policy about a rejection too, and keeps the reason in the audit event", async () => {
    const { service, policy, audited } = setUp();

    const result = await service.decideSpr(
      "SO-0001",
      { type: "SPR_REJECTED", reason: "Wrong vendor" },
      SPR,
      approver,
      INFO,
      AT,
    );

    expect(result.state.status).toBe("StockChecked");
    expect(policy.enforce).toHaveBeenCalledOnce();
    expect(audited[0]?.changes).toMatchObject({ reason: "Wrong vendor" });
  });

  it("changes nothing when the policy refuses", async () => {
    const { service, repository, audit } = setUp({ policyRefuses: true });

    const error = await service
      .decideSpr("SO-0001", { type: "SPR_APPROVED" }, SPR, approver, INFO, AT)
      .catch(refusal);

    expect(refusal(error).code).toBe("FORBIDDEN");
    expect(repository.saveTransition).not.toHaveBeenCalled();
    // Area 4's enforce audits its own refusal, so a second event would double it.
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("does not trouble the policy when the move is illegal anyway", async () => {
    const { service, policy } = setUp({
      stored: {
        id: "instance-1",
        version: 3,
        state: state({ status: "Closed" }),
      },
    });

    await service
      .decideSpr("SO-0001", { type: "SPR_APPROVED" }, SPR, approver, INFO, AT)
      .catch(refusal);

    expect(policy.enforce).not.toHaveBeenCalled();
  });

  it("refuses a system actor, because a person decides an SPR", async () => {
    const { service, policy } = setUp();

    const error = await service
      .decideSpr(
        "SO-0001",
        { type: "SPR_APPROVED" },
        SPR,
        { kind: "system", name: "checks" },
        INFO,
        AT,
      )
      .catch(refusal);

    expect(refusal(error).code).toBe("FORBIDDEN");
    expect(policy.enforce).not.toHaveBeenCalled();
  });
});

describe("OrderWorkflowService, reading status", () => {
  it("answers with the status, Navision's status and the holds", async () => {
    const { service } = setUp({
      stored: {
        id: "instance-1",
        version: 3,
        state: state({
          status: "OnHold",
          holds: ["check"],
          resumeTo: "AwaitingSpr",
        }),
      },
    });

    await expect(service.statusOf("SO-0001")).resolves.toEqual({
      orderRef: "SO-0001",
      status: "OnHold",
      navisionStatus: "Pending Approval",
      holds: ["check"],
      resumeTo: "AwaitingSpr",
      currentStep: "spr-approval",
      ownerRole: "APPROVER",
      since: AT,
      open: true,
    });
  });

  it("answers null for no workflow, and for a sample the machine never ran", async () => {
    await expect(
      setUp({ stored: null }).service.statusOf("SO-9999"),
    ).resolves.toBeNull();
    await expect(
      setUp({
        stored: { id: "instance-1", version: 0, state: null },
      }).service.statusOf("SO-0001"),
    ).resolves.toBeNull();
  });
});

describe("order transitions (the state machine)", () => {
  /** Every API source file, so a new writer anywhere is noticed. */
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (name === "generated") return [];
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return name.endsWith(".ts") && !name.endsWith(".test.ts") ? [path] : [];
    });
  }

  const WRITES = [
    // Any write method, including createManyAndReturn and a nested or aliased call.
    /workflowInstance["'\]]*\s*\.\s*(create|update|upsert|delete)\w*/,
    /workflowEvent["'\]]*\s*\.\s*(create|update|upsert|delete)\w*/,
    // Raw SQL names the table, however the client is reached.
    /\$(executeRaw|queryRaw)[\s\S]{0,300}"Workflow(Instance|Event)"/,
    /(UPDATE|INSERT\s+INTO|DELETE\s+FROM)\s+"Workflow(Instance|Event)"/,
  ];

  it("is the only code that writes a workflow instance's status", () => {
    const root = join(import.meta.dirname, "..", "..");
    const writers = sourceFiles(root)
      .filter((path) => {
        const text = readFileSync(path, "utf8");
        return WRITES.some((pattern) => pattern.test(text));
      })
      .map((path) => path.slice(root.length + 1).replaceAll("\\", "/"))
      .sort();

    expect(writers).toEqual([
      "modules/workflows/order-workflow.repository.ts",
      "modules/workflows/workflows-seed.ts",
    ]);
  });

  it("notices the kinds of write the scan is there to catch", () => {
    for (const text of [
      "this.tx.workflowInstance.update({",
      "client.workflowInstance\n  .createManyAndReturn({",
      'client["workflowInstance"].updateMany({',
      'tx.$executeRaw`UPDATE "WorkflowInstance" SET status = 1`',
    ]) {
      expect(
        WRITES.some((pattern) => pattern.test(text)),
        text,
      ).toBe(true);
    }
  });

  it("leaves the seed writing only labels the machine would refuse as a status", () => {
    for (const order of syntheticDataset().orders) {
      expect(orderStatusSchema.safeParse(order.sampleScreenState).success).toBe(
        false,
      );
    }
  });
});
