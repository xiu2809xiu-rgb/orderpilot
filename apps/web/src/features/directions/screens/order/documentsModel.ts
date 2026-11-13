import type { CheckResult, DocumentType } from "@orderpilot/shared";

/** How a document stands, from what the checks say: a difference was found, every check passed, or none has run. */
export type MatchState = "differs" | "matches" | "unchecked";

export interface OrderDocumentRow {
  /** The id the checks cite. */
  id: string;
  type: DocumentType;
  state: MatchState;
  passed: number;
  failed: number;
  /** The rules that ran against it, failed ones first. */
  rules: { id: string; label: string; outcome: CheckResult["outcome"] }[];
}

/**
 * The documents of an order, read from what the checks cite as their evidence.
 * Nothing is invented: a document appears when a check read it, and the
 * customer's PO always appears because the order exists. Its state is what the
 * checks say: every one passed, or at least one found a difference. Whether a
 * document waits for a person to confirm it is the order's fact, not a
 * document's: the tracker does not say which one, so no document is marked.
 */
export function documentsOf(
  checks: readonly CheckResult[],
  options: { orderNo: string },
): OrderDocumentRow[] {
  const byId = new Map<string, OrderDocumentRow>();
  for (const check of checks) {
    for (const evidence of check.evidence) {
      const row = byId.get(evidence.documentId) ?? {
        id: evidence.documentId,
        type: evidence.documentType,
        state: "unchecked" as MatchState,
        passed: 0,
        failed: 0,
        rules: [],
      };
      if (!row.rules.some((rule) => rule.id === check.id)) {
        row.rules.push({
          id: check.id,
          label: check.ruleLabel,
          outcome: check.outcome,
        });
        if (check.outcome === "pass") row.passed += 1;
        else row.failed += 1;
      }
      byId.set(evidence.documentId, row);
    }
  }
  if (![...byId.values()].some((row) => row.type === "CUSTOMER_PO")) {
    byId.set(`${options.orderNo}-customer-po`, {
      id: `${options.orderNo}-customer-po`,
      type: "CUSTOMER_PO",
      state: "unchecked",
      passed: 0,
      failed: 0,
      rules: [],
    });
  }
  const rows = [...byId.values()].map((row) => {
    row.rules.sort(
      (a, b) => Number(a.outcome === "pass") - Number(b.outcome === "pass"),
    );
    const state: MatchState =
      row.failed > 0 ? "differs" : row.passed > 0 ? "matches" : "unchecked";
    return { ...row, state };
  });
  // The customer's PO leads, then the rest in the order the checks met them.
  return rows.sort(
    (a, b) =>
      Number(b.type === "CUSTOMER_PO") - Number(a.type === "CUSTOMER_PO"),
  );
}
