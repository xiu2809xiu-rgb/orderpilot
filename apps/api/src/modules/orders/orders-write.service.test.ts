import type { CreateSalesOrderBody } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import type { AuditService } from "../../audit/audit.service.js";
import type { Database } from "../../database/database.js";
import type { CustomerLookup } from "../master-data/customer-lookup.js";
import type { ItemLookup } from "../master-data/item-lookup.js";
import {
  ConflictError,
  type DomainError,
  ValidationFailedError,
} from "../../common/domain-error.js";
import type {
  HandoffAnswer,
  OrderHandoff,
  OrderSubmitted,
} from "./domain/order-handoff.js";
import { SalesOrder } from "./domain/sales-order.js";
import { OrderMasking } from "./domain/order-masking.js";
import {
  DuplicateOrderError,
  OrderConflictError,
} from "./domain/order-errors.js";
import type { OrderNumberAllocator } from "./order-number.allocator.js";
import type { OrdersService } from "./orders.service.js";
import { OrdersWriteService } from "./orders-write.service.js";
import type { SalesOrderRepository } from "./sales-order.repository.js";

const actor = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "support@example.test",
  displayName: "Synthetic Support",
  role: "SUPPORT",
} as const;
const info = { ip: null, traceId: "t-1" };
const body: CreateSalesOrderBody = {
  customerNo: "C-0001",
  externalDocumentNo: "PO-1",
  orderDate: "2026-11-10",
  shipmentDate: null,
  prepaymentPercent: "0",
  lines: [{ itemNo: "I-0001", quantity: "1", unitPrice: "2.00" }],
};

function build(options: { winner: string | null; insertFails: boolean }) {
  const steps: string[] = [];
  let open = false;
  const database = {
    transaction: async <T>(work: () => Promise<T>): Promise<T> => {
      open = true;
      try {
        return await work();
      } finally {
        open = false;
      }
    },
  };
  // The first read is the early, friendly one. Only a read after the failed
  // insert may name the winner, so the fake answers null until then.
  let failed = false;
  const repository = {
    findLiveByPo: () => {
      steps.push(open ? "read-inside" : "read-outside");
      return Promise.resolve(failed ? options.winner : null);
    },
    insert: () => {
      steps.push("insert");
      if (!options.insertFails) return Promise.reject(new Error("unused"));
      failed = true;
      return Promise.reject(new OrderConflictError("clash"));
    },
  };
  const numbers = {
    next: () => {
      steps.push(open ? "number-inside" : "number-outside");
      return Promise.resolve("SO-20261110-0001");
    },
  };
  const service = new OrdersWriteService(
    database as unknown as Database,
    repository as unknown as SalesOrderRepository,
    numbers as unknown as OrderNumberAllocator,
    { record: () => Promise.resolve({}) } as unknown as AuditService,
    {
      namesOf: () => Promise.resolve(new Map([["C-0001", "Synthetic Co"]])),
    } as unknown as CustomerLookup,
    {
      detailsOf: () =>
        Promise.resolve(
          new Map([["I-0001", { description: "Item", unitPrice: "2.00" }]]),
        ),
    } as unknown as ItemLookup,
    new OrderMasking(),
    {} as unknown as OrdersService,
    {} as unknown as OrderHandoff,
  );
  return { service, steps };
}

describe("OrdersWriteService.create", () => {
  it("allocates the number inside the transaction, so a rollback leaves no gap", async () => {
    const { service, steps } = build({ winner: null, insertFails: true });
    await service.create(body, actor, info).catch(() => undefined);
    expect(steps).toContain("number-inside");
    expect(steps).not.toContain("number-outside");
  });

  it("reads the winner after the transaction, never inside the aborted one", async () => {
    const { service, steps } = build({
      winner: "SO-20261110-0007",
      insertFails: true,
    });
    const error: unknown = await service
      .create(body, actor, info)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DuplicateOrderError);
    expect((error as DuplicateOrderError).details).toContainEqual({
      path: "existingOrderNo",
      message: "SO-20261110-0007",
    });
    expect(steps.indexOf("insert")).toBeLessThan(
      steps.lastIndexOf("read-outside"),
    );
    expect(steps).not.toContain("read-inside");
  });

  it("rethrows a conflict that no live order explains", async () => {
    const { service } = build({ winner: null, insertFails: true });
    await expect(service.create(body, actor, info)).rejects.toBeInstanceOf(
      OrderConflictError,
    );
  });
});

describe("OrdersWriteService.update", () => {
  const stored = new SalesOrder({
    orderNo: "SO-20261110-0001",
    navisionNo: null,
    captureState: "draft",
    customerNo: "C-0001",
    externalDocumentNo: "PO-1",
    orderDate: "2026-11-10",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "0",
    createdBy: actor.id,
    lines: [
      {
        lineNo: 1,
        itemNo: "I-0001",
        description: "Item",
        quantity: "1",
        unitPrice: "2.00",
        qtyToShip: "1",
      },
    ],
  });

  function buildUpdate() {
    let reads = 0;
    const service = new OrdersWriteService(
      {
        transaction: <T>(work: () => Promise<T>) => work(),
      } as unknown as Database,
      {
        findByNo: () => Promise.resolve(stored),
        findLiveByPo: () => {
          reads += 1;
          return Promise.resolve(null);
        },
        update: () => Promise.resolve(true),
      } as unknown as SalesOrderRepository,
      {} as unknown as OrderNumberAllocator,
      { record: () => Promise.resolve({}) } as unknown as AuditService,
      {
        namesOf: () => Promise.resolve(new Map([["C-0001", "Synthetic Co"]])),
      } as unknown as CustomerLookup,
      {
        detailsOf: () =>
          Promise.resolve(
            new Map([["I-0001", { description: "Item", unitPrice: "2.00" }]]),
          ),
      } as unknown as ItemLookup,
      new OrderMasking(),
      { one: () => Promise.resolve({}) } as unknown as OrdersService,
      {} as unknown as OrderHandoff,
    );
    return { service, reads: () => reads };
  }

  it("skips the early duplicate read when neither the customer nor the PO number changes", async () => {
    const { service, reads } = buildUpdate();
    await service.update(
      stored.orderNo,
      { version: 1, prepaymentPercent: "10", externalDocumentNo: "PO-1" },
      actor,
      info,
    );
    expect(reads()).toBe(0);
  });

  it("reads early when the PO number changes", async () => {
    const { service, reads } = buildUpdate();
    await service.update(
      stored.orderNo,
      { version: 1, externalDocumentNo: "PO-2" },
      actor,
      info,
    );
    expect(reads()).toBe(1);
  });
});

describe("OrdersWriteService.submitDraft", () => {
  const draftInput = {
    orderNo: "SO-20261110-0001",
    navisionNo: null,
    captureState: "draft" as const,
    customerNo: "C-0001",
    externalDocumentNo: "PO-1",
    orderDate: "2026-11-10",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "30.00",
    createdBy: actor.id,
    version: 2,
    lines: [
      {
        lineNo: 1,
        itemNo: "I-0001",
        description: "Item",
        quantity: "3",
        unitPrice: "31.97",
        qtyToShip: "3",
      },
    ],
  };
  const draft = new SalesOrder(draftInput);
  const submittedOrder = new SalesOrder({
    ...draftInput,
    captureState: "submitted",
  });
  const when = new Date("2026-11-26T03:00:00.000Z");
  const send = { version: 2 };

  interface Audited {
    action: string;
    changes: Record<string, unknown> | null | undefined;
    insideTransaction: boolean;
  }

  function buildSubmit(
    options: {
      stored?: SalesOrder;
      later?: SalesOrder;
      marked?: boolean;
      handoff?: () => Promise<HandoffAnswer>;
      customerKnown?: boolean;
      itemKnown?: boolean;
    } = {},
  ) {
    const steps: string[] = [];
    const audited: Audited[] = [];
    const facts: OrderSubmitted[] = [];
    let open = false;
    let reads = 0;
    const database = {
      transaction: async <T>(work: () => Promise<T>): Promise<T> => {
        steps.push("begin");
        open = true;
        try {
          const done = await work();
          steps.push("commit");
          return done;
        } catch (error) {
          steps.push("rollback");
          throw error;
        } finally {
          open = false;
        }
      },
    };
    const repository = {
      findByNo: () => {
        reads += 1;
        return Promise.resolve(
          reads === 1 ? (options.stored ?? draft) : (options.later ?? draft),
        );
      },
      markSubmitted: () => {
        steps.push("update");
        return Promise.resolve(options.marked ?? true);
      },
    };
    const handoff = {
      submitted: (fact: OrderSubmitted) => {
        steps.push("handoff");
        facts.push(fact);
        return (
          options.handoff?.() ?? Promise.resolve({ effect: "none" as const })
        );
      },
    };
    const audit = {
      record: (input: { action: string; changes?: Audited["changes"] }) => {
        steps.push(`audit:${input.action}`);
        audited.push({
          action: input.action,
          changes: input.changes,
          insideTransaction: open,
        });
        return Promise.resolve({});
      },
    };
    const service = new OrdersWriteService(
      database as unknown as Database,
      repository as unknown as SalesOrderRepository,
      {} as unknown as OrderNumberAllocator,
      audit as unknown as AuditService,
      {
        namesOf: () =>
          Promise.resolve(
            options.customerKnown === false
              ? new Map()
              : new Map([["C-0001", "Synthetic Co"]]),
          ),
      } as unknown as CustomerLookup,
      {
        detailsOf: () =>
          Promise.resolve(
            options.itemKnown === false
              ? new Map()
              : new Map([
                  ["I-0001", { description: "Item", unitPrice: "31.97" }],
                ]),
          ),
      } as unknown as ItemLookup,
      new OrderMasking(),
      {
        one: () => {
          steps.push("read-back");
          return Promise.resolve({ orderNo: "SO-20261110-0001" });
        },
      } as unknown as OrdersService,
      handoff as unknown as OrderHandoff,
    );
    return { service, steps, audited, facts };
  }

  it("runs the guarded update, then the handoff, then the audit row, all inside the transaction", async () => {
    const { service, steps, audited } = buildSubmit();
    await service.submitDraft(draft.orderNo, send, actor, info, when);
    expect(steps).toEqual([
      "begin",
      "update",
      "handoff",
      "audit:order.submitted",
      "commit",
      "read-back",
    ]);
    expect(audited.map((a) => a.insideTransaction)).toEqual([true]);
  });

  it("hands the handoff the fact once, with the person and the request", async () => {
    const { service, facts } = buildSubmit();
    await service.submitDraft(
      draft.orderNo,
      send,
      actor,
      { ip: "203.0.113.9", traceId: "t-9" },
      when,
    );
    expect(facts).toEqual([
      {
        orderNo: "SO-20261110-0001",
        customerNo: "C-0001",
        submittedBy: {
          userId: actor.id,
          name: "Synthetic Support",
          role: "SUPPORT",
        },
        submittedAt: when,
        total: "95.91",
        prepaymentPercent: "30.00",
        poVersionNo: 1,
        request: { ip: "203.0.113.9", traceId: "t-9" },
      },
    ]);
  });

  it("puts the workflow effect in the audit row and no total, price or line", async () => {
    const { service, audited } = buildSubmit({
      handoff: () => Promise.resolve({ effect: "applied" }),
    });
    await service.submitDraft(draft.orderNo, send, actor, info, when);
    expect(audited[0]?.changes).toEqual({
      lines: 1,
      version: { from: 2, to: 3 },
      poVersionNo: 1,
      workflowEffect: "applied",
    });
    const text = JSON.stringify(audited[0]);
    for (const secret of ["95.91", "31.97", "I-0001", "C-0001", "PO-1"])
      expect(text).not.toContain(secret);
  });

  it("refuses a submitted order with the state words, before it compares the version", async () => {
    const { service, steps } = buildSubmit({ stored: submittedOrder });
    const error: unknown = await service
      .submitDraft(draft.orderNo, { version: 99 }, actor, info, when)
      .catch((e: unknown) => e);
    expect(error).toEqual(
      new ConflictError("Order SO-20261110-0001 is already submitted."),
    );
    expect(steps).toEqual([]);
  });

  it("refuses a stale version without calling the handoff", async () => {
    const { service, steps } = buildSubmit();
    const error: unknown = await service
      .submitDraft(draft.orderNo, { version: 1 }, actor, info, when)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictError);
    expect((error as ConflictError).message).toContain(
      "changed by someone else",
    );
    expect(steps).toEqual([]);
  });

  it("says the order is already submitted when the guarded update changes nothing and the order is submitted now", async () => {
    const { service, steps } = buildSubmit({
      marked: false,
      later: submittedOrder,
    });
    await expect(
      service.submitDraft(draft.orderNo, send, actor, info, when),
    ).rejects.toThrow("Order SO-20261110-0001 is already submitted.");
    expect(steps).toEqual(["begin", "update", "commit"]);
  });

  it("says the order was changed when the guarded update changes nothing and the order is still a draft", async () => {
    const { service } = buildSubmit({ marked: false, later: draft });
    await expect(
      service.submitDraft(draft.orderNo, send, actor, info, when),
    ).rejects.toThrow("changed by someone else");
  });

  it("lets the handoff's DomainError through unchanged, and writes one order.submit.refused row after the transaction, with its code and no message", async () => {
    const refusal = new ConflictError(
      "The order cannot start: synthetic reason.",
    );
    const { service, steps, audited } = buildSubmit({
      handoff: () => Promise.reject(refusal),
    });
    const error: unknown = await service
      .submitDraft(draft.orderNo, send, actor, info, when)
      .catch((e: unknown) => e);
    expect(error).toBe(refusal);
    expect(steps).toEqual([
      "begin",
      "update",
      "handoff",
      "rollback",
      "audit:order.submit.refused",
    ]);
    expect(audited).toEqual([
      {
        action: "order.submit.refused",
        changes: { refusedBy: "workflow", code: "CONFLICT", version: 2 },
        insideTransaction: false,
      },
    ]);
    expect(JSON.stringify(audited)).not.toContain("synthetic reason");
  });

  it("does not write a refusal row for a plain Error from the handoff", async () => {
    const { service, steps, audited } = buildSubmit({
      handoff: () => Promise.reject(new Error("the workflow is down")),
    });
    await expect(
      service.submitDraft(draft.orderNo, send, actor, info, when),
    ).rejects.toThrow("the workflow is down");
    expect(audited).toEqual([]);
    expect(steps).toEqual(["begin", "update", "handoff", "rollback"]);
  });

  it("refuses an unknown customer and an unknown item with a 400 and calls nothing", async () => {
    const noCustomer = buildSubmit({ customerKnown: false });
    const first: unknown = await noCustomer.service
      .submitDraft(draft.orderNo, send, actor, info, when)
      .catch((e: unknown) => e);
    expect(first).toBeInstanceOf(ValidationFailedError);
    expect((first as DomainError).details).toEqual([
      {
        path: "customerNo",
        message: "No customer has this Business Central number.",
      },
    ]);
    const noItem = buildSubmit({ itemKnown: false });
    const second: unknown = await noItem.service
      .submitDraft(draft.orderNo, send, actor, info, when)
      .catch((e: unknown) => e);
    expect((second as DomainError).details).toEqual([
      {
        path: "lines.0.itemNo",
        message: "No item has this Business Central number.",
      },
    ]);
    expect(noCustomer.steps).toEqual([]);
    expect(noItem.steps).toEqual([]);
  });
});
