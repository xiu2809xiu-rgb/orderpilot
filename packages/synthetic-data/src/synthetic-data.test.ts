import {
  INBOX_ROLES,
  addDecimal,
  compareDecimal,
  decimalStringSchema,
  documentRefSchema,
  parseRecordNumber,
  salesHeaderSchema,
  salesLineSchema,
  workflowReminderSchema,
  workflowTaskSchema,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import {
  AS_OF,
  DEFAULT_SEED,
  SAMPLE_SCREEN_STATES,
  SYNTHETIC_LABEL,
  SeededRandom,
  addDays,
  availableStock,
  createSyntheticDataset,
  daysBetween,
  describeDataset,
  syntheticDataset,
  todayInSingapore,
} from "./index.js";

describe("SeededRandom", () => {
  it("gives the same numbers for the same seed", () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    expect([a.next(), a.next(), a.int(1, 99)]).toEqual([
      b.next(),
      b.next(),
      b.int(1, 99),
    ]);
  });

  it("gives different numbers for another seed, and stays in range", () => {
    expect(new SeededRandom(1).next()).not.toBe(new SeededRandom(2).next());
    const r = new SeededRandom(7);
    for (let i = 0; i < 500; i++) {
      const n = r.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
    }
  });
});

describe("dates", () => {
  it("counts days and finds today in Singapore, which is 8 hours ahead of UTC", () => {
    expect(addDays("2026-11-02", -60)).toBe("2026-09-03");
    expect(daysBetween("2026-09-03", "2026-11-02")).toBe(60);
    expect(todayInSingapore(new Date("2026-11-01T15:59:00Z"))).toBe(
      "2026-11-01",
    );
    expect(todayInSingapore(new Date("2026-11-01T16:00:00Z"))).toBe(
      "2026-11-02",
    );
  });
});

describe("the synthetic dataset", () => {
  const data = createSyntheticDataset();

  it("is deterministic: the same seed and date give byte-identical data", () => {
    const again = createSyntheticDataset({
      seed: DEFAULT_SEED,
      referenceDate: AS_OF,
    });
    expect(JSON.stringify(again)).toBe(JSON.stringify(data));
    expect(describeDataset(data)).toBe(describeDataset(again));
  });

  it("changes with the seed, but keeps its shape", () => {
    const other = createSyntheticDataset({ seed: 1 });
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(data));
    expect(other.items.map((i) => i.no)).toEqual(data.items.map((i) => i.no));
    const states = (d: typeof data) =>
      d.orders.map((o) => o.sampleScreenState).sort();
    expect(states(other)).toEqual(states(data));
  });

  it("is labelled, and returns fresh objects each time", () => {
    expect(data.label).toBe(SYNTHETIC_LABEL);
    expect(data.label).toBe("Synthetic demo data");
    const first = createSyntheticDataset();
    first.customers.length = 0;
    expect(createSyntheticDataset().customers).toHaveLength(40);
    expect(describeDataset(data)).toContain(
      "Synthetic demo data: 40 customers, 12 vendors, 300 items, 120 orders",
    );
  });

  it("builds the whole set quickly", () => {
    const started = performance.now();
    createSyntheticDataset({ referenceDate: "2027-03-01" });
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it("has 40 customers in the brief's countries, 12 vendors and 300 items", () => {
    expect(data.customers).toHaveLength(40);
    expect(data.vendors).toHaveLength(12);
    expect(data.items).toHaveLength(300);
    expect(data.orders).toHaveLength(120);
    for (const country of ["IN", "LK", "BD", "PK", "AE"]) {
      expect(
        data.customers.filter((c) => c.countryRegionCode === country),
      ).toHaveLength(8);
    }
    expect(new Set(data.customers.map((c) => c.name)).size).toBe(40);
  });

  it("spreads the items over IT, surveillance and accessories, each with a part number", () => {
    for (const category of ["IT", "SURVEILLANCE", "ACCESSORIES"]) {
      expect(data.items.filter((i) => i.category === category)).toHaveLength(
        100,
      );
    }
    expect(new Set(data.items.map((i) => i.partNumber)).size).toBe(300);
    expect(new Set(data.items.map((i) => i.no)).size).toBe(300);
    expect(new Set(data.items.map((i) => i.brand)).size).toBe(12);
  });

  it("uses Navision's names and USD decimal strings", () => {
    expect(Object.keys(data.customers[0] ?? {}).sort()).toEqual([
      "balanceLcy",
      "countryRegionCode",
      "creditLimitLcy",
      "currencyCode",
      "customerPriceGroup",
      "name",
      "no",
      "paymentTermsCode",
    ]);
    for (const item of data.items) {
      for (const value of [
        item.unitPrice,
        item.unitCost,
        item.inventory,
        item.qtyOnSalesOrder,
        item.qtyOnPurchOrder,
      ]) {
        expect(decimalStringSchema.safeParse(value).success, value).toBe(true);
      }
      expect(compareDecimal(item.unitCost, item.unitPrice)).toBe(-1);
    }
    for (const order of data.orders) {
      expect(
        salesHeaderSchema.safeParse(order.header).success,
        order.header.no,
      ).toBe(true);
      for (const l of order.lines) {
        expect(salesLineSchema.safeParse(l).success).toBe(true);
      }
      expect(order.header.currencyCode).toBe("USD");
    }
  });

  it("links everything: vendors, customers, items and orders", () => {
    const vendors = new Set(data.vendors.map((v) => v.no));
    const customers = new Set(data.customers.map((c) => c.no));
    const items = new Set(data.items.map((i) => i.no));
    const orders = new Set(data.orders.map((o) => o.header.no));
    expect(data.items.every((i) => vendors.has(i.vendorNo))).toBe(true);
    expect(
      data.orders.every((o) => customers.has(o.header.sellToCustomerNo)),
    ).toBe(true);
    expect(
      data.orders.every((o) => o.lines.every((l) => items.has(l.no))),
    ).toBe(true);
    expect(orders.size).toBe(120);
    for (const row of [
      ...data.payments,
      ...data.sprs,
      ...data.tasks.map((t) => ({ orderNo: t.orderNo ?? "" })),
      ...data.reminders,
      ...data.exceptions,
    ]) {
      expect(orders.has(row.orderNo)).toBe(true);
    }
    expect(data.vendorBankAccounts.map((b) => b.vendorNo).sort()).toEqual(
      [...vendors].sort(),
    );
  });

  it("opens with stock and balances", () => {
    expect(compareDecimal(data.openingBalances.stockValueLcy, "0")).toBe(1);
    expect(compareDecimal(data.openingBalances.receivablesLcy, "0")).toBe(1);
    expect(compareDecimal(data.openingBalances.payablesLcy, "0")).toBe(1);
  });
});

describe("the orders and their states", () => {
  const data = createSyntheticDataset();
  const inState = (state: string) =>
    data.orders.filter((o) => o.sampleScreenState === state);

  it("covers every sample state, none of them an order status", () => {
    expect(SAMPLE_SCREEN_STATES.every((s) => s.startsWith("sample-"))).toBe(
      true,
    );
    for (const state of SAMPLE_SCREEN_STATES) {
      expect(inState(state).length, state).toBeGreaterThanOrEqual(6);
    }
  });

  it("has more orders in the middle of the flow than at its ends, and closed ones", () => {
    const count = (state: string) => inState(state).length;
    expect(count("sample-awaiting-payment")).toBeGreaterThan(
      count("sample-po-received"),
    );
    expect(count("sample-ready-to-pick")).toBeGreaterThan(
      count("sample-po-received"),
    );
    expect(count("sample-closed")).toBeGreaterThan(0);
  });

  it("spreads the orders over the last 60 days, with the oldest numbered first", () => {
    const ages = data.orders.map((o) => o.ageDays);
    expect(Math.max(...ages)).toBeGreaterThan(40);
    expect(Math.max(...ages)).toBeLessThanOrEqual(60);
    expect(Math.min(...ages)).toBe(0);
    for (const order of data.orders) {
      expect(daysBetween(order.header.orderDate, data.asOf)).toBe(
        order.ageDays,
      );
    }
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
  });

  it("totals each order from its lines and keeps every line within stock, bar the short ones", () => {
    for (const order of data.orders) {
      const sum = order.lines.reduce(
        (total, l) => addDecimal(total, l.lineAmount),
        "0.00",
      );
      expect(order.total).toBe(sum);
      expect(Number(order.total)).toBeGreaterThan(1_000);
      for (const l of order.lines) {
        const item = data.items.find((i) => i.no === l.no);
        if (!item) throw new Error("missing item");
        if (order.stockShortfall?.itemNo === l.no) continue;
        expect(Number(l.quantity)).toBeLessThanOrEqual(
          Number(availableStock(item)),
        );
      }
    }
  });

  it("gives each product manager the orders of their brands", () => {
    for (const order of data.orders) {
      const first = order.lines[0];
      const item = data.items.find((i) => i.no === first?.no);
      const owner = data.brands.find((b) => b.name === item?.brand)?.owner;
      expect(order.owners.productManager).toBe(owner);
    }
    const managers = data.people.filter((p) => p.role === "PRODUCT_MANAGER");
    expect(managers).toHaveLength(3);
    expect(managers.flatMap((m) => m.brands).sort()).toEqual(
      data.brands.map((b) => b.name).sort(),
    );
  });

  it("lists documents for each order as its state implies, in the shared record format", () => {
    for (const order of data.orders) {
      const types = order.documents.map((d) => d.type);
      expect(types[0]).toBe("CUSTOMER_PO");
      for (const doc of order.documents) {
        expect(
          documentRefSchema.safeParse({
            id: doc.id,
            type: doc.type,
            fileName: doc.fileName,
            receivedAt: doc.receivedAt ?? `${doc.dueDate ?? AS_OF}T00:00:00Z`,
            source: doc.source,
          }).success,
          doc.id,
        ).toBe(true);
        if (doc.type === "PROFORMA_INVOICE") {
          expect(parseRecordNumber(doc.number ?? "")?.type).toBe("PI");
        }
      }
    }
    const shipped = inState("sample-shipped")[0];
    expect(shipped?.documents.map((d) => d.type)).toEqual(
      expect.arrayContaining([
        "CUSTOMER_PO",
        "PROFORMA_INVOICE",
        "PACKING_LIST",
      ]),
    );
    const late = inState("sample-awb-overdue")[0];
    const awb = late?.documents.find(
      (d) => d.type === "AWB" || d.type === "BILL_OF_LADING",
    );
    expect(awb).toMatchObject({ status: "expected", number: null });
    const invoiced = inState("sample-invoiced")[0];
    expect(invoiced?.documents.map((d) => d.type)).toContain("SALES_INVOICE");
    expect(inState("sample-po-received")[0]?.documents).toHaveLength(1);
    expect(inState("sample-po-received")[0]?.documents[0]?.status).toBe(
      "to-confirm",
    );
  });

  it("numbers OrderPilot's own records in the shared format, each once", () => {
    const numbers = [
      ...data.sprs.map((s) => s.recordNo),
      ...data.exceptions.map((e) => e.recordNo),
      ...data.orders.flatMap((o) =>
        o.documents
          .filter((d) => d.type === "PROFORMA_INVOICE")
          .map((d) => d.number ?? ""),
      ),
    ];
    for (const number of numbers)
      expect(parseRecordNumber(number)).not.toBeNull();
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(data.sprs[0]?.recordNo).toMatch(/^SPR-\d{8}-0001$/);
  });
});

describe("one story across the screens", () => {
  const data = createSyntheticDataset();
  const orderOf = (no: string) => {
    const order = data.orders.find((o) => o.header.no === no);
    if (!order) throw new Error(`no order ${no}`);
    return order;
  };

  it("makes a stock purchase request for every short order, by the formula in prompt 002", () => {
    const short = data.orders.filter((o) => o.stockShortfall);
    expect(short.length).toBeGreaterThan(30);
    expect(data.sprs).toHaveLength(short.length);
    for (const spr of data.sprs) {
      const item = data.items.find((i) => i.no === spr.itemNo);
      if (!item) throw new Error("missing item");
      // Inventory minus Qty. on Sales Order plus Qty. on Purch. Order.
      const available = addDecimal(
        addDecimal(item.inventory, `-${item.qtyOnSalesOrder}`),
        item.qtyOnPurchOrder,
      );
      expect(spr.basis.availableStock).toBe(available);
      expect(addDecimal(spr.basis.ordered, `-${available}`)).toBe(spr.quantity);
      expect(spr.basis.shortfall).toBe(spr.quantity);
      expect(compareDecimal(spr.quantity, "0")).toBe(1);
      expect(spr.vendorNo).toBe(item.vendorNo);
      expect(parseRecordNumber(spr.recordNo)?.type).toBe("SPR");
    }
    for (const order of data.orders.filter(
      (o) => o.scenario.kind === "short-stock",
    )) {
      const spr = data.sprs.find((s) => s.orderNo === order.header.no);
      expect(spr?.status).toBe("suggested");
      if (order.scenario.kind !== "short-stock") throw new Error("kind");
      expect(spr?.quantity).toBe(order.scenario.shortBy);
      expect(order.scenario.suggestedSpr.quantity).toBe(spr?.quantity);
    }
  });

  it("waits on payment with a payment task for Finance and an expected prepayment", () => {
    const waiting = data.orders.filter(
      (o) => o.scenario.kind === "awaiting-payment",
    );
    expect(waiting.length).toBeGreaterThanOrEqual(10);
    for (const order of waiting) {
      expect(order.header.navisionStatus).toBe("Pending Prepayment");
      const payment = data.payments.find(
        (p) => p.orderNo === order.header.no && p.status === "expected",
      );
      if (order.scenario.kind !== "awaiting-payment") throw new Error("kind");
      expect(payment?.amount).toBe(order.scenario.amountDue);
      expect(["prepayment", "deposit"]).toContain(payment?.paymentType);
      const task = data.tasks.find((t) => t.orderNo === order.header.no);
      expect(task).toMatchObject({
        kind: "CONFIRM_PAYMENT",
        assigneeRole: "FINANCE",
      });
    }
  });

  it("confirms the prepayment of every order past that point, with a type and a reference", () => {
    const types = new Set(data.payments.map((p) => p.paymentType));
    expect(types).toContain("prepayment");
    for (const payment of data.payments) {
      if (payment.status === "confirmed") {
        expect(payment.reference).not.toBeNull();
        expect(payment.paidOn && payment.paidOn <= data.asOf).toBe(true);
      } else {
        expect(payment.paidOn).toBeNull();
      }
    }
    for (const order of data.orders.filter(
      (o) => o.sampleScreenState === "sample-closed",
    )) {
      expect(
        data.payments
          .filter((p) => p.orderNo === order.header.no)
          .every((p) => p.status === "confirmed"),
      ).toBe(true);
    }
  });

  it("raises an exception with expected and found values for a packing-list mismatch", () => {
    const mismatches = data.orders.filter(
      (o) => o.scenario.kind === "packing-list-mismatch",
    );
    expect(mismatches.length).toBeGreaterThanOrEqual(5);
    for (const order of mismatches) {
      if (order.scenario.kind !== "packing-list-mismatch")
        throw new Error("kind");
      const exception = data.exceptions.find(
        (e) => e.orderNo === order.header.no && e.state === "OPEN",
      );
      expect(exception?.expected).toBe(
        order.scenario.ordered.replace(/\.0+$/, ""),
      );
      expect(exception?.found).not.toBe(exception?.expected);
      expect(exception?.fixBy).toBe("SUPPORT");
      expect(
        order.documents.find((d) => d.type === "PACKING_LIST")?.status,
      ).toBe("to-confirm");
    }
  });

  it("raises one late-document exception and a Logistics task for each overdue AWB", () => {
    const late = data.orders.filter((o) => o.scenario.kind === "awb-overdue");
    expect(late.length).toBeGreaterThanOrEqual(5);
    for (const order of late) {
      if (order.scenario.kind !== "awb-overdue") throw new Error("kind");
      expect(order.scenario.dueDate < data.asOf).toBe(true);
      expect(order.header.packageTrackingNo).toBeNull();
      expect(
        data.exceptions.some(
          (e) =>
            e.orderNo === order.header.no && e.ruleId === "mock.sample-awb-due",
        ),
      ).toBe(true);
      expect(
        data.tasks.find((t) => t.orderNo === order.header.no),
      ).toMatchObject({ assigneeRole: "LOGISTICS", overdue: true });
    }
  });

  it("opens only exceptions for open work, and resolves the ones on closed orders", () => {
    for (const exception of data.exceptions) {
      const order = orderOf(exception.orderNo);
      if (exception.state === "OPEN") {
        expect(exception.resolvedAt).toBeNull();
        expect(order.sampleScreenState).not.toBe("sample-closed");
      } else {
        expect(exception.resolvedAt).not.toBeNull();
        expect(
          exception.resolvedAt && exception.resolvedAt >= exception.openedAt,
        ).toBe(true);
      }
    }
  });

  it("gives one open task to each order that has work waiting, valid against the contract", () => {
    const seen = new Set<string>();
    for (const task of data.tasks) {
      expect(workflowTaskSchema.safeParse(task).success, task.id).toBe(true);
      expect(task.status).toBe("OPEN");
      expect(task.orderNo && seen.has(task.orderNo)).toBe(false);
      if (task.orderNo) seen.add(task.orderNo);
      const order = orderOf(task.orderNo ?? "");
      expect(task.amount).toBe(order.total);
      expect(task.customerName).toBe(customerOf(data, order));
      expect(task.overdue).toBe(task.dueAt.slice(0, 10) < data.asOf);
    }
    for (const reminder of data.reminders) {
      expect(workflowReminderSchema.safeParse(reminder).success).toBe(true);
    }
  });

  it("gives every inbox role enough work to fill a home page", () => {
    for (const role of INBOX_ROLES) {
      const tasks = data.tasks.filter((t) => t.assigneeRole === role);
      expect(tasks.length, role).toBeGreaterThanOrEqual(8);
      expect(tasks.filter((t) => t.overdue).length, role).toBeGreaterThan(0);
      expect(
        tasks.filter((t) => t.priority === "high").length,
        role,
      ).toBeGreaterThan(0);
      expect(
        new Set(tasks.map((t) => t.customerNo)).size,
        role,
      ).toBeGreaterThanOrEqual(5);
      expect(
        new Set(tasks.map((t) => t.dueAt.slice(0, 10))).size,
        role,
      ).toBeGreaterThanOrEqual(4);
      expect(
        new Set(tasks.map((t) => Math.round(Number(t.amount) / 5000))).size,
        role,
      ).toBeGreaterThanOrEqual(3);
    }
    expect(new Set(data.tasks.map((t) => t.kind)).size).toBe(7);
  });

  it("reminds roles about the tasks that are due or late, and escalates the very late", () => {
    expect(data.reminders.length).toBeGreaterThan(20);
    expect(new Set(data.reminders.map((r) => r.stage))).toEqual(
      new Set(["scheduled", "sent", "escalated"]),
    );
    for (const reminder of data.reminders.filter(
      (r) => r.stage === "escalated",
    )) {
      expect(reminder.escalatedTo).toBe("MANAGEMENT");
    }
  });

  it("has five KPI series of twelve weeks with targets, ending where the orders stand", () => {
    expect(data.kpis.map((k) => k.id)).toEqual([
      "processingTime",
      "manualTouches",
      "dataEntryErrors",
      "approvalTurnaround",
      "overdueOrders",
    ]);
    for (const kpi of data.kpis) {
      expect(kpi.weekly).toHaveLength(12);
      expect(kpi.target).toBeGreaterThan(0);
      const starts = kpi.weekly.map((w) => w.weekStart);
      expect(starts).toEqual([...starts].sort());
      for (const week of starts) {
        expect(new Date(`${week}T00:00:00Z`).getUTCDay()).toBe(1);
      }
    }
    const overdue = data.orders.filter(
      (o) => o.step.dueOn !== null && o.step.dueOn < data.asOf,
    ).length;
    const series = data.kpis.find((k) => k.id === "overdueOrders");
    expect(series?.weekly.at(-1)?.value).toBe(overdue);
    expect(data.tasks.filter((t) => t.overdue).length).toBeLessThanOrEqual(
      overdue,
    );
  });
});

describe("relative to today", () => {
  const later = createSyntheticDataset({ referenceDate: "2026-11-23" });
  const base = createSyntheticDataset();

  it("shifts every date with the reference date and keeps the story the same", () => {
    expect(later.asOf).toBe("2026-11-23");
    expect(later.orders.map((o) => o.sampleScreenState)).toEqual(
      base.orders.map((o) => o.sampleScreenState),
    );
    expect(later.orders.map((o) => o.ageDays)).toEqual(
      base.orders.map((o) => o.ageDays),
    );
    expect(later.orders[5]?.header.orderDate).toBe(
      addDays(base.orders[5]?.header.orderDate ?? "", 21),
    );
    expect(later.tasks.filter((t) => t.overdue)).toHaveLength(
      base.tasks.filter((t) => t.overdue).length,
    );
    for (const order of later.orders) {
      expect(order.ageDays).toBeLessThanOrEqual(60);
    }
  });

  it("keeps overdue true: an overdue AWB is still late three weeks on", () => {
    for (const order of later.orders) {
      if (order.scenario.kind === "awb-overdue") {
        expect(order.scenario.daysOverdue).toBeGreaterThan(0);
        expect(order.scenario.dueDate < later.asOf).toBe(true);
      }
    }
  });

  it("is built once a day: the same date gives the same set", () => {
    const a = syntheticDataset({ referenceDate: "2026-12-01" });
    expect(syntheticDataset({ referenceDate: "2026-12-01" })).toBe(a);
    expect(syntheticDataset({ referenceDate: "2026-12-02" })).not.toBe(a);
    expect(syntheticDataset().asOf).toBe(todayInSingapore());
  });

  it("refuses a reference date that is not a date", () => {
    expect(() => createSyntheticDataset({ referenceDate: "tomorrow" })).toThrow(
      RangeError,
    );
  });
});

describe("looking fake", () => {
  const data = createSyntheticDataset();

  it("has bank details that cannot be real, and no national ID numbers", () => {
    for (const bank of data.vendorBankAccounts) {
      expect(bank.iban.startsWith("ZZ")).toBe(true);
      expect(bank.swiftCode).toContain("DEMO");
      expect(bank.name).toContain("not a real bank");
    }
    expect(JSON.stringify(data)).not.toMatch(/\b\d{3}-\d{2}-\d{4}\b/);
  });
});

function customerOf(
  data: ReturnType<typeof createSyntheticDataset>,
  order: { header: { sellToCustomerNo: string } },
): string | undefined {
  return data.customers.find((c) => c.no === order.header.sellToCustomerNo)
    ?.name;
}
