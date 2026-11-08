import type { OrderCaptureState, OrderSource } from "@orderpilot/shared";

export interface OrderFactsLine {
  readonly lineNo: number;
  /** The item's Navision number. */
  readonly itemNo: string;
  readonly description: string;
  readonly quantity: string;
  readonly unitPrice: string;
  /** What is left to ship on the line. */
  readonly qtyToShip: string;
}

/** Set when a line wanted more than the item had. Only a sample carries one today. */
export interface OrderFactsShortfall {
  readonly itemNo: string;
  readonly ordered: string;
  readonly availableStock: string;
  readonly shortBy: string;
  /** The purchase order an approved SPR raised for the rest, or null while it waits. */
  readonly coveredBy: string | null;
}

/** What is late and since when, as the tracker counts it. */
export interface OrderFactsOverdue {
  readonly daysOverdue: number;
  readonly step: string;
  readonly dueDate: string;
}

/**
 * One order as everything else asks for it, whether it is a sample or a stored
 * row. Neither kind invents what it does not have: a sample has no capture
 * state, and a stored order has no workflow status and no owner yet.
 */
export interface OrderFacts {
  readonly orderNo: string;
  readonly source: OrderSource;
  readonly captureState: OrderCaptureState | null;
  readonly customerNo: string;
  /** The name the source knows, or null: a stored order carries none, master data supplies it. */
  readonly customerName: string | null;
  readonly externalDocumentNo: string;
  readonly orderDate: string;
  readonly shipmentDate: string | null;
  readonly currencyCode: string;
  readonly prepaymentPercent: string;
  readonly navisionNo: string | null;
  /** Counts the saves of a stored order. Null for a sample: it cannot be edited. */
  readonly version: number | null;
  /** Area 2's label as text, or null when the order has no workflow. */
  readonly workflowStatus: string | null;
  readonly total: string;
  readonly lines: readonly OrderFactsLine[];
  readonly stockShortfall: OrderFactsShortfall | null;
  readonly overdue: OrderFactsOverdue | null;
}
