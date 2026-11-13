import type { CheckResult, DocumentType } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { documentsOf } from "./documentsModel";

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
