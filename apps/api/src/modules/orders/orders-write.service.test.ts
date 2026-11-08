import type { CreateSalesOrderBody } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import type { AuditService } from "../../audit/audit.service.js";
import type { Database } from "../../database/database.js";
import type { CustomerLookup } from "../master-data/customer-lookup.js";
import type { ItemLookup } from "../master-data/item-lookup.js";
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
