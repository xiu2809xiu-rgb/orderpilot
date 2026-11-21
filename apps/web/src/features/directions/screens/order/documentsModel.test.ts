import type { CheckResult, DocumentType } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { documentsOf, withFlow, withPending } from "./documentsModel";
import { step } from "./orderPageTestKit";

const check = (
  id: string,
  outcome: "pass" | "fail",
  docs: [string, DocumentType][],
): CheckResult => ({
  id,
  ruleId: `rule.${id}`,
  ruleLabel: `Rule ${id}`,
  orderNo: "SO-1",
  outcome,
  expected: "1",
  actual: "1",
  tolerance: { label: "Exact", value: "0" },
  evidence: docs.map(([documentId, documentType]) => ({
    documentId,
    documentType,
    location: "header",
    value: "1",
  })),
  checkedAt: "2026-11-10T09:00:00.000Z",
});

const OPTIONS = { orderNo: "SO-1" };

describe("documentsOf", () => {
  it("lists a document once, with the checks that read it", () => {
    const rows = documentsOf(
      [
        check("1", "pass", [["po", "CUSTOMER_PO"]]),
        check("2", "pass", [["po", "CUSTOMER_PO"]]),
      ],
      OPTIONS,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "po",
      passed: 2,
      failed: 0,
      state: "matches",
    });
  });

  it("says a document differs when any check against it failed, failed rules first", () => {
    const rows = documentsOf(
      [
        check("1", "pass", [
          ["po", "CUSTOMER_PO"],
          ["pl", "PACKING_LIST"],
        ]),
        check("2", "fail", [["pl", "PACKING_LIST"]]),
      ],
      OPTIONS,
    );
    const list = rows.find((row) => row.type === "PACKING_LIST");
    expect(list?.state).toBe("differs");
    expect(list?.rules.map((rule) => rule.outcome)).toEqual(["fail", "pass"]);
    expect(rows.find((row) => row.type === "CUSTOMER_PO")?.state).toBe(
      "matches",
    );
  });

  it("always shows the customer's PO first, even when no check has read it", () => {
    const rows = documentsOf(
      [check("1", "pass", [["pi", "PROFORMA_INVOICE"]])],
      OPTIONS,
    );
    expect(rows.map((row) => row.type)).toEqual([
      "CUSTOMER_PO",
      "PROFORMA_INVOICE",
    ]);
    expect(rows[0]).toMatchObject({
      id: "SO-1-customer-po",
      state: "unchecked",
    });
    expect(documentsOf([], OPTIONS)).toHaveLength(1);
  });
});

describe("withFlow", () => {
  const flow = (
    id: string,
    type: DocumentType,
    status: "confirmed" | "to-confirm" | "expected",
  ) => ({
    id,
    type,
    number: null,
    status,
    receivedAt: null,
    dueDate: null,
  });

  it("gives a workflow document the checked row of its type, and lists one the checks never read", () => {
    const rows = withFlow(
      documentsOf([check("1", "fail", [["pl", "PACKING_LIST"]])], OPTIONS),
      [flow("f1", "PACKING_LIST", "to-confirm"), flow("f2", "AWB", "expected")],
    );
    const packing = rows.find((row) => row.type === "PACKING_LIST");
    expect(packing).toMatchObject({ id: "pl", state: "differs" });
    expect(packing?.flow?.status).toBe("to-confirm");
    expect(rows.find((row) => row.type === "AWB")).toMatchObject({
      state: "unchecked",
      rules: [],
    });
    // One document is one row, and the customer's PO still leads.
    expect(rows.filter((row) => row.type === "PACKING_LIST")).toHaveLength(1);
    expect(rows[0]?.type).toBe("CUSTOMER_PO");
  });

  it("leaves the checked rows as they are when the workflow lists nothing", () => {
    const rows = documentsOf(
      [check("1", "pass", [["po", "CUSTOMER_PO"]])],
      OPTIONS,
    );
    expect(withFlow(rows, [])).toEqual(rows);
  });
});

describe("withPending", () => {
  const po = documentsOf(
    [check("1", "pass", [["po", "CUSTOMER_PO"]])],
    OPTIONS,
  );
  const kinds = (rows: ReturnType<typeof withPending>) =>
    rows.map((row) => [row.type, row.pending ? "pending" : "has"]);

  it("lists the papers still to come after the ones the order has, in the order they are made", () => {
    const rows = withPending(po, { steps: [] });
    expect(kinds(rows)).toEqual([
      ["CUSTOMER_PO", "has"],
      ["PROFORMA_INVOICE", "pending"],
      ["PACKING_LIST", "pending"],
      ["SALES_INVOICE", "pending"],
      ["AWB", "pending"],
    ]);
    expect(rows[4]?.pending?.shipping).toBe(true);
  });

  it("does not list a paper the order already has, and counts either shipping paper as the one", () => {
    const rows = withPending(
      [
        ...po,
        ...withFlow(
          [],
          [
            {
              id: "bl",
              type: "BILL_OF_LADING",
              number: null,
              status: "expected",
              receivedAt: null,
              dueDate: "2026-11-23",
            },
            {
              id: "pl",
              type: "PACKING_LIST",
              number: "PL-1",
              status: "confirmed",
              receivedAt: "2026-11-05T01:00:00.000Z",
              dueDate: null,
            },
          ],
        ),
      ],
      { steps: [] },
    );
    expect(kinds(rows).filter(([, state]) => state === "pending")).toEqual([
      ["PROFORMA_INVOICE", "pending"],
      ["SALES_INVOICE", "pending"],
    ]);
  });

  it("says a paper is made, though no copy is on record, when its step is done", () => {
    const rows = withPending(po, {
      steps: [step("invoiced", "done"), step("pi-sent", "upcoming")],
    });
    const byType = (type: string) => rows.find((row) => row.type === type);
    expect(byType("SALES_INVOICE")?.pending?.made).toBe(true);
    expect(byType("PACKING_LIST")?.pending?.made).toBe(true);
    expect(byType("PROFORMA_INVOICE")?.pending?.made).toBe(false);
  });

  it("says nothing of what is missing without the workflow's record", () => {
    expect(withPending(po, undefined)).toEqual(po);
  });
});
