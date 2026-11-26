import type {
  CreateSalesOrderBody,
  PoVersionDifferences,
} from "@orderpilot/shared";
import type { OrderNotice } from "./OrderNotices";
import type { RevisionFailure } from "./revisionFailure";

/** Where the panel is in asking what a revised PO would change and confirming it. */
export type RevisionPhase =
  | { kind: "loading" }
  | { kind: "previewFailed"; failure: RevisionFailure }
  | { kind: "identical"; data: PoVersionDifferences }
  // `failure` is what the last confirmation ran into, if it did.
  | {
      kind: "ready";
      data: PoVersionDifferences;
      failure: RevisionFailure | null;
    }
  | { kind: "confirming"; data: PoVersionDifferences };

/** The header values a person may want to keep from the stored order. */
export const KEPT_FIELDS = [
  "orderDate",
  "shipmentDate",
  "prepaymentPercent",
] as const;

/** What the stored order holds for the three header values, from the differences' earlier side. */
export function storedHeader(data: PoVersionDifferences): {
  orderDate: string | null;
  shipmentDate: string | null;
  prepaymentPercent: string | null;
} {
  const from = (field: (typeof KEPT_FIELDS)[number]) =>
    data.header.find((row) => row.field === field)?.from ?? null;
  return {
    orderDate: from("orderDate"),
    shipmentDate: from("shipmentDate"),
    prepaymentPercent: from("prepaymentPercent"),
  };
}

/** True when the typed PO differs from the stored order in a header value that can be kept. */
export function headerDiffers(data: PoVersionDifferences): boolean {
  return data.header.some(
    (row) => row.changed && KEPT_FIELDS.some((field) => field === row.field),
  );
}

/**
 * The body again with the stored order's dates and prepayment in place of the
 * typed ones: what "Keep the order's dates and prepayment" asks about next.
 * Everything else of the body is the typed PO's own.
 */
export function keptBodyOf(
  body: CreateSalesOrderBody,
  data: PoVersionDifferences,
): CreateSalesOrderBody {
  const stored = storedHeader(data);
  return {
    ...body,
    orderDate: stored.orderDate ?? body.orderDate,
    shipmentDate: stored.shipmentDate,
    prepaymentPercent: stored.prepaymentPercent ?? body.prepaymentPercent,
  };
}

/** What the panel holds while it is open: the body it asks about, and where it is. */
export interface Run {
  /** The notice this run belongs to; a new refusal is a new run. */
  of: Extract<OrderNotice, { kind: "duplicate" }>;
  body: CreateSalesOrderBody;
  phase: RevisionPhase;
  kept: boolean;
  /** The confirmation was saved: the panel stays as it is until the page changes. */
  saved: boolean;
}
