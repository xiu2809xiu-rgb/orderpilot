import type {
  CheckResult,
  DocumentType,
  OrderFlowDocument,
} from "@orderpilot/shared";

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
  /** What the workflow knows of the same document: its number, when it came or is due, and whether a person has confirmed it. */
  flow?: OrderFlowDocument;
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

/**
 * The documents the workflow knows (received, waiting for a person, still
 * expected) set against what the checks read. A workflow document takes the
 * checked row of its own type, so one document is one row; one the checks never
 * read is a row with no rules; a checked document the workflow does not list
 * keeps its row. The customer's PO still leads.
 */
export function withFlow(
  rows: readonly OrderDocumentRow[],
  flow: readonly OrderFlowDocument[],
): OrderDocumentRow[] {
  if (flow.length === 0) return [...rows];
  const claimed = new Set<string>();
  const merged: OrderDocumentRow[] = flow.map((document) => {
    const checked = rows.find(
      (row) => row.type === document.type && !claimed.has(row.id),
    );
    if (checked) {
      claimed.add(checked.id);
      return { ...checked, flow: document };
    }
    return {
      id: document.id,
      type: document.type,
      state: "unchecked",
      passed: 0,
      failed: 0,
      rules: [],
      flow: document,
    };
  });
  const rest = rows.filter((row) => !claimed.has(row.id));
  return [...merged, ...rest].sort(
    (a, b) =>
      Number(b.type === "CUSTOMER_PO") - Number(a.type === "CUSTOMER_PO"),
  );
}
