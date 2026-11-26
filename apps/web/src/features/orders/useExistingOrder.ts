import { useOrdersOne } from "@/lib/api/generated/endpoints/orders/orders";

/** What the order that a repeated PO number belongs to is, as far as the page can tell. */
export interface ExistingOrder {
  /** `reading` until the order answers; `unknown` for a sample, a refusal or a failed read. */
  kind: "reading" | "draft" | "submitted" | "void" | "unknown";
  /** The PO version a confirmation would add: the current one plus one. */
  next: number | null;
  current: number | null;
  orderDate: string | null;
  lineCount: number | null;
  currency: string | null;
  /** Area 2's label for its stage, or null when no team holds the order. */
  stage: string | null;
}

const NOTHING = {
  next: null,
  current: null,
  orderDate: null,
  lineCount: null,
  currency: null,
  stage: null,
} as const;

/**
 * Reads the order that a refused create named, so the notice can say what it is
 * and what can be done: edit it if it is a draft, add a PO version if it is
 * submitted. Asked only for a repeated PO number from a create; the read is made
 * once and never repeated on a refocus or a reconnect, so the notice does not
 * change its words under a person's eyes.
 */
export function useExistingOrder(orderNo: string | null): ExistingOrder | null {
  const query = useOrdersOne(orderNo ?? "", {
    query: {
      enabled: orderNo !== null,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  });
  if (orderNo === null) return null;
  if (query.isPending) return { kind: "reading", ...NOTHING };
  const detail = query.data?.data;
  if (!detail) return { kind: "unknown", ...NOTHING };
  if (detail.captureState === "draft") return { kind: "draft", ...NOTHING };
  if (detail.captureState === "void") return { kind: "void", ...NOTHING };
  // A sample has no capture state, and a submitted order without a number is
  // not one this page knows how to revise.
  if (detail.captureState !== "submitted" || detail.poVersionNo === null) {
    return { kind: "unknown", ...NOTHING };
  }
  return {
    kind: "submitted",
    next: detail.poVersionNo + 1,
    current: detail.poVersionNo,
    orderDate: detail.orderDate,
    lineCount: detail.lines.length,
    currency: detail.currencyCode,
    stage: detail.workflowStatus,
  };
}
