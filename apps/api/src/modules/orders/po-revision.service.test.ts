import type {
  ConfirmPoVersionBody,
  CreateSalesOrderBody,
  Role,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import type { AuditService } from "../../audit/audit.service.js";
import {
  ConflictError,
  DomainError,
  ValidationFailedError,
} from "../../common/domain-error.js";
import type { Database } from "../../database/database.js";
import type { CustomerLookup } from "../master-data/customer-lookup.js";
import type { ItemLookup } from "../master-data/item-lookup.js";
import type {
  HandoffAnswer,
  OrderHandoff,
  PoVersionConfirmed,
} from "./domain/order-handoff.js";
import { OrderMasking } from "./domain/order-masking.js";
import { SalesOrder } from "./domain/sales-order.js";
import type { OrdersService } from "./orders.service.js";
import { PoRevisionService } from "./po-revision.service.js";
import type { PoVersionRepository } from "./po-version.repository.js";

const person = (role: Role) =>
  ({
    id: "00000000-0000-4000-8000-000000000002",
    email: "support@example.test",
    displayName: "Synthetic Support",
    role,
  }) as const;
const support = person("SUPPORT");
const warehouse = person("WAREHOUSE");
const info = { ip: "203.0.113.9", traceId: "t-revise" };
const NOW = new Date("2026-11-26T03:00:00.000Z");

const stored = (
  over: Partial<ConstructorParameters<typeof SalesOrder>[0]> = {},
) =>
  new SalesOrder({
    orderNo: "SO-20261108-0001",
    navisionNo: null,
    captureState: "submitted",
    customerNo: "C-0001",
    externalDocumentNo: "PO-7788",
    orderDate: "2026-11-08",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "30.00",
    createdBy: "00000000-0000-4000-8000-000000000001",
    version: 4,
    poVersionNo: 1,
    lines: [
      {
        lineNo: 1,
        itemNo: "I-0001",
        description: "First item",
        quantity: "5.000",
        unitPrice: "31.97",
        qtyToShip: "5.000",
      },
      {
        lineNo: 2,
        itemNo: "I-0002",
        description: "Second item",
        quantity: "2.000",
        unitPrice: "33.41",
        qtyToShip: "2.000",
      },
    ],
    ...over,
  });

/** The stored order's own content, so a body that matches it is identical. */
const same: CreateSalesOrderBody = {
  customerNo: "C-0001",
  externalDocumentNo: "PO-7788",
  orderDate: "2026-11-08",
  shipmentDate: null,
  prepaymentPercent: "30",
  lines: [
    { itemNo: "I-0001", quantity: "5", unitPrice: "31.97" },
    { itemNo: "I-0002", quantity: "2", unitPrice: "33.41" },
  ],
};
const revision: CreateSalesOrderBody = {
  ...same,
  orderDate: "2026-11-20",
  lines: [
    { itemNo: "I-0001", quantity: "8", unitPrice: "35.77" },
    { itemNo: "I-0002", quantity: "2", unitPrice: "33.41" },
  ],
};
const confirmBody = (
  over: Partial<ConfirmPoVersionBody> = {},
  from: CreateSalesOrderBody = revision,
): ConfirmPoVersionBody => ({
  ...from,
  confirmed: true,
  expectedPoVersionNo: 1,
  ...over,
});

interface Options {
  readonly head?: SalesOrder | null;
  /** What the second read of the head gives, after a refused move. */
  readonly after?: SalesOrder | null;
  readonly moves?: boolean;
  readonly handoff?: () => Promise<HandoffAnswer>;
  readonly known?: boolean;
}

function build(options: Options = {}) {
  const steps: string[] = [];
  const facts: PoVersionConfirmed[] = [];
  const audits: Record<string, unknown>[] = [];
  let open = false;
  const database = {
    transaction: async <T>(work: () => Promise<T>): Promise<T> => {
      open = true;
      steps.push("tx-open");
      try {
        const result = await work();
        steps.push("tx-commit");
        return result;
      } catch (error) {
        steps.push("tx-rollback");
        throw error;
      } finally {
        open = false;
      }
    },
  };
  let reads = 0;
  const poVersions = {
    headOf: () => {
      reads += 1;
      const first = options.head === undefined ? stored() : options.head;
      return Promise.resolve(
        reads === 1
          ? first
          : options.after === undefined
            ? first
            : options.after,
      );
    },
    supersede: (next: SalesOrder, expected: number) => {
      steps.push(
        `supersede:${String(next.poVersionNo)}:${String(expected)}:${open ? "in" : "out"}`,
      );
      return Promise.resolve(options.moves ?? true);
    },
  };
  const audit = {
    record: (event: { action: string } & Record<string, unknown>) => {
      steps.push(`audit:${event.action}:${open ? "in" : "out"}`);
      audits.push(event);
      return Promise.resolve({});
    },
  };
  const handoff = {
    poVersionConfirmed: (fact: PoVersionConfirmed) => {
      steps.push(`handoff:${open ? "in" : "out"}`);
      facts.push(fact);
      return (
        options.handoff?.() ??
        Promise.resolve<HandoffAnswer>({ effect: "none" })
      );
    },
  };
  const items = new Map([
    ["I-0001", { description: "First item", unitPrice: "31.97" }],
    ["I-0002", { description: "Second item", unitPrice: "33.41" }],
  ]);
  const service = new PoRevisionService(
    database as unknown as Database,
    poVersions as unknown as PoVersionRepository,
    audit as unknown as AuditService,
    {
      namesOf: () =>
        Promise.resolve(
          options.known === false
            ? new Map()
            : new Map([["C-0001", "Synthetic Co"]]),
        ),
    } as unknown as CustomerLookup,
    {
      detailsOf: (nos: readonly string[]) =>
        Promise.resolve(new Map([...items].filter(([no]) => nos.includes(no)))),
    } as unknown as ItemLookup,
    new OrderMasking(),
    {
      one: () => Promise.resolve({ orderNo: "SO-20261108-0001" }),
    } as unknown as OrdersService,
    handoff as unknown as OrderHandoff,
  );
  return { service, steps, facts, audits };
}

const refusal = async (call: Promise<unknown>): Promise<DomainError> => {
  const error: unknown = await call.catch((e: unknown) => e);
  if (error instanceof DomainError) return error;
  throw new Error("did not throw a DomainError");
};

describe("PoRevisionService.confirm", () => {
  it("runs the lock-guarded supersede, then the handoff, then the audit row, all inside the transaction", async () => {
    const { service, steps } = build();
    await service.confirm(
      "SO-20261108-0001",
      confirmBody(),
      support,
      info,
      NOW,
    );
    expect(steps).toEqual([
      "tx-open",
      "supersede:2:1:in",
      "handoff:in",
      "audit:order.po_version_confirmed:in",
      "tx-commit",
    ]);
  });

  it("hands the handoff the fact once, with the person and the request", async () => {
    const { service, facts } = build();
    await service.confirm(
      "SO-20261108-0001",
      confirmBody(),
      support,
      info,
      NOW,
    );
    expect(facts).toEqual([
      {
        orderNo: "SO-20261108-0001",
        poVersionNo: 2,
        supersedesPoVersionNo: 1,
        confirmedBy: {
          userId: support.id,
          name: "Synthetic Support",
          role: "SUPPORT",
        },
        confirmedAt: NOW,
        total: "352.98",
        prepaymentPercent: "30.00",
        request: info,
      },
    ]);
  });

  it("puts the workflow effect and the changed header fields in the audit row and no total, price or line", async () => {
    const { service, audits } = build({
      handoff: () => Promise.resolve({ effect: "applied" }),
    });
    await service.confirm(
      "SO-20261108-0001",
      confirmBody(),
      support,
      info,
      NOW,
    );
    expect(audits).toHaveLength(1);
    const row = audits[0] as {
      changes: Record<string, unknown>;
      summary: string;
    };
    expect(row.changes).toEqual({
      poVersionNo: { from: 1, to: 2 },
      version: { from: 4, to: 5 },
      lines: 2,
      headerFields: ["orderDate"],
      lineChanges: { added: 0, removed: 0, changed: 1, moved: 0 },
      workflowEffect: "applied",
    });
    const text = JSON.stringify(audits);
    for (const secret of [
      "352.98",
      "35.77",
      "31.97",
      "33.41",
      "I-0001",
      "PO-7788",
    ])
      expect(text).not.toContain(secret);
    expect(row.summary).toBe(
      "Synthetic Support confirmed PO version 2 of order SO-20261108-0001",
    );
  });

  it("refuses a draft and a void order before it compares the number", async () => {
    for (const state of ["draft", "void"] as const) {
      const { service, steps } = build({
        head: stored({ captureState: state }),
      });
      const error = await refusal(
        service.confirm(
          "SO-20261108-0001",
          confirmBody({ expectedPoVersionNo: 99 }),
          support,
          info,
          NOW,
        ),
      );
      expect(error.code).toBe("CONFLICT");
      expect(error.details).toEqual([{ path: "captureState", message: state }]);
      expect(steps).toEqual([]);
    }
  });

  it("refuses a stale number without calling the handoff", async () => {
    const { service, steps } = build({ head: stored({ poVersionNo: 3 }) });
    const error = await refusal(
      service.confirm("SO-20261108-0001", confirmBody(), support, info, NOW),
    );
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe(
      "Order SO-20261108-0001 is now at PO version 3, and you compared with PO version 1. Compare again before you confirm.",
    );
    expect(error.details).toEqual([
      { path: "currentPoVersionNo", message: "3" },
    ]);
    expect(steps).toEqual([]);
  });

  it("says the order is now at the newer PO version when the guarded supersede changes nothing", async () => {
    const { service, steps } = build({
      moves: false,
      after: stored({ poVersionNo: 2 }),
    });
    const error = await refusal(
      service.confirm("SO-20261108-0001", confirmBody(), support, info, NOW),
    );
    expect(error.details).toEqual([
      { path: "currentPoVersionNo", message: "2" },
    ]);
    expect(steps).toEqual(["tx-open", "supersede:2:1:in", "tx-commit"]);
  });

  it("says the order is void when the supersede changes nothing and the order is void now", async () => {
    const { service } = build({
      moves: false,
      after: stored({ captureState: "void" }),
    });
    const error = await refusal(
      service.confirm("SO-20261108-0001", confirmBody(), support, info, NOW),
    );
    expect(error.details).toEqual([{ path: "captureState", message: "void" }]);
  });

  it("refuses another customer, another PO number, an unknown item and a shipment before the order date, and calls nothing", async () => {
    const cases: [Partial<CreateSalesOrderBody>, string][] = [
      [{ customerNo: "C-0002" }, "customerNo"],
      [{ externalDocumentNo: "PO-9999" }, "externalDocumentNo"],
      [
        { lines: [{ itemNo: "I-0404", quantity: "1", unitPrice: "1.00" }] },
        "lines.0.itemNo",
      ],
      [{ orderDate: "2026-11-20", shipmentDate: "2026-11-01" }, "shipmentDate"],
    ];
    for (const [over, path] of cases) {
      const { service, steps } = build();
      const error = await refusal(
        service.confirm(
          "SO-20261108-0001",
          confirmBody({ ...over }),
          support,
          info,
          NOW,
        ),
      );
      expect(error).toBeInstanceOf(ValidationFailedError);
      expect(error.details?.map((d) => d.path)).toContain(path);
      expect(steps).toEqual([]);
    }
  });

  it("refuses identical content with a 400 on revision and calls nothing", async () => {
    const { service, steps } = build();
    const error = await refusal(
      service.confirm(
        "SO-20261108-0001",
        confirmBody({}, same),
        support,
        info,
        NOW,
      ),
    );
    expect(error).toBeInstanceOf(ValidationFailedError);
    expect(error.details).toEqual([
      {
        path: "revision",
        message:
          "This PO has the same dates, quantities and prices as PO version 1, so there is nothing to confirm. Descriptions are not compared.",
      },
    ]);
    expect(steps).toEqual([]);
  });

  it("lets the handoff's DomainError through unchanged and writes one order.po_version_confirm.refused row after the transaction, with its code and no message", async () => {
    const said = new ConflictError(
      "Order SO-20261108-0001 is held for payment.",
    );
    const { service, steps, audits } = build({
      handoff: () => Promise.reject(said),
    });
    const error = await refusal(
      service.confirm("SO-20261108-0001", confirmBody(), support, info, NOW),
    );
    expect(error).toBe(said);
    expect(steps).toEqual([
      "tx-open",
      "supersede:2:1:in",
      "handoff:in",
      "tx-rollback",
      "audit:order.po_version_confirm.refused:out",
    ]);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      action: "order.po_version_confirm.refused",
      summary:
        "Synthetic Support's confirmation of PO version 2 of order SO-20261108-0001 was refused by the order flow",
      changes: {
        refusedBy: "workflow",
        code: "CONFLICT",
        poVersionNo: { from: 1, to: 2 },
      },
    });
    const text = JSON.stringify(audits);
    expect(text).not.toContain("held for payment");
    expect(text).not.toContain("35.77");
  });

  it("does not write a refusal row for a plain Error from the handoff", async () => {
    const { service, steps, audits } = build({
      handoff: () => Promise.reject(new Error("the port broke")),
    });
    await expect(
      service.confirm("SO-20261108-0001", confirmBody(), support, info, NOW),
    ).rejects.toThrow("the port broke");
    expect(audits).toEqual([]);
    expect(steps).toContain("tx-rollback");
  });
});

describe("PoRevisionService.preview", () => {
  it("preview builds the same differences as confirm for the same body and writes nothing and calls no port", async () => {
    const previewing = build();
    const preview = await previewing.service.preview(
      "SO-20261108-0001",
      revision,
      support,
    );
    expect(previewing.steps).toEqual([]);
    expect(previewing.audits).toEqual([]);
    expect(previewing.facts).toEqual([]);
    const confirming = build();
    const confirmed = await confirming.service.confirm(
      "SO-20261108-0001",
      confirmBody(),
      support,
      info,
      NOW,
    );
    expect(JSON.stringify(confirmed.differences)).toBe(JSON.stringify(preview));
    expect(preview.identical).toBe(false);
    expect(preview.lines.find((l) => l.itemNo === "I-0001")).toMatchObject({
      status: "changed",
      quantity: { from: "5.000", to: "8.000", changed: true },
    });
  });

  it("previews identical content as identical, and writes nothing", async () => {
    const { service } = build();
    const preview = await service.preview("SO-20261108-0001", same, support);
    expect(preview.identical).toBe(true);
  });

  it("a role that may edit but cannot see prices gets differences with no price key and a status from quantities only, from preview and from confirm", async () => {
    // A masked writer cannot send a price: it keeps the stored one by position.
    const quantitiesOnly: CreateSalesOrderBody = {
      ...same,
      orderDate: "2026-11-20",
      lines: [
        { itemNo: "I-0001", quantity: "8" },
        { itemNo: "I-0002", quantity: "2" },
      ],
    };
    const { service } = build();
    const preview = await service.preview(
      "SO-20261108-0001",
      quantitiesOnly,
      warehouse,
    );
    const confirmed = await build().service.confirm(
      "SO-20261108-0001",
      confirmBody({}, quantitiesOnly),
      warehouse,
      info,
      NOW,
    );
    for (const answer of [preview, confirmed.differences]) {
      expect(answer.pricesCompared).toBe(false);
      const text = JSON.stringify(answer);
      for (const price of ["31.97", "33.41", "322.58", "255.76"])
        expect(text).not.toContain(price);
      expect(answer.total).toEqual({
        masked: true,
        field: "item.unitPrice",
        classification: expect.any(String) as unknown,
        reason: "price",
      });
      for (const line of answer.lines)
        expect(Object.keys(line.unitPrice).sort()).toEqual([
          "classification",
          "field",
          "masked",
          "reason",
        ]);
      expect(answer.lines.map((l) => l.status)).toEqual([
        "changed",
        "unchanged",
      ]);
    }
  });
});
