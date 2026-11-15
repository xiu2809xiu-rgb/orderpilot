import type {
  OrderCaptureState,
  OrderSource,
  OverdueFlag,
  ReportedStatus,
  Role,
  SalesFlow,
  SalesOrderRow,
  TrackerOrder,
} from "@orderpilot/shared";
import { SALES_STEP_IDS } from "../../data/estimates";

/** The step number that means every one of the nine is done. */
export const ALL_DONE = 10;

/**
 * One order as the merged workspace shows it. The Orders list is the base: it
 * holds every order, the ones entered here too, and it masks the amount by
 * role. The tracker adds what only it knows: the status code, the team that
 * holds the order, the overdue flag and the open exceptions. The tracker's own
 * amount is never read, because it is not masked.
 */
export interface OrderRow {
  orderNo: string;
  source: OrderSource;
  captureState: OrderCaptureState | null;
  customerNo: string;
  customerName: string | null;
  externalDocumentNo: string;
  orderDate: string;
  shipmentDate: string | null;
  /** Area 2's label as the Orders list reports it. */
  workflowStatus: string | null;
  amount: SalesOrderRow["amount"];
  currencyCode: string;
  shortage: SalesOrderRow["shortage"];
  shortageCount: number;
  /** Null for an order the tracker does not know, such as a draft entered here. */
  status: ReportedStatus | null;
  ownerRole: Role | null;
  overdue: OverdueFlag | null;
  openExceptions: number;
  /** A document of this order waits for a person to confirm it. */
  toConfirm: boolean;
  /** Where the order is in the nine steps, 1 to 9; 10 when all are done; null when unknown. */
  step: number | null;
}

/**
 * The step each status belongs to, read from the tracker's own flow. A status
 * the flow does not list is a finished order, and one the tracker does not
 * know at all has no step.
 */
export function stepOfStatus(
  flow: SalesFlow | undefined,
  code: string | null,
): number | null {
  if (!flow || code === null) return null;
  const at = flow.steps.findIndex((step) => step.statuses.includes(code));
  return at >= 0 ? at + 1 : ALL_DONE;
}

export interface JoinInput {
  orders: readonly SalesOrderRow[];
  tracker: readonly TrackerOrder[];
  toConfirm: ReadonlySet<string>;
  flow: SalesFlow | undefined;
}

export function joinOrders({
  orders,
  tracker,
  toConfirm,
  flow,
}: JoinInput): OrderRow[] {
  const byNo = new Map(tracker.map((row) => [row.orderNo, row]));
  return orders.map((order) => {
    const known = byNo.get(order.orderNo);
    return {
      orderNo: order.orderNo,
      source: order.source,
      captureState: order.captureState,
      customerNo: order.customerNo,
      customerName: order.customerName,
      externalDocumentNo: order.externalDocumentNo,
      orderDate: order.orderDate,
      shipmentDate: order.shipmentDate,
      workflowStatus: order.workflowStatus,
      amount: order.amount,
      currencyCode: order.currencyCode,
      shortage: order.shortage,
      shortageCount: order.shortageCount,
      status: known?.status ?? null,
      ownerRole: known?.ownerRole ?? null,
      overdue: known?.overdue ?? null,
      openExceptions: known?.openExceptions ?? 0,
      toConfirm: toConfirm.has(order.orderNo),
      step: stepOfStatus(flow, known?.status.code ?? null),
    };
  });
}

/** An order that is late or has a check that found a difference. */
export function isHeldUp(row: OrderRow): boolean {
  return row.overdue?.overdue === true || row.openExceptions > 0;
}

/** Still moving: not finished and, for an entered order, not voided. */
export function isOpen(row: OrderRow): boolean {
  if (row.step !== null) return row.step < ALL_DONE;
  return row.captureState !== "void";
}

/**
 * An order whose entry state says the tracker and the workflow have never
 * heard of it: a draft is still being entered, and a void one was dropped
 * before it started. Asking either would only collect a 404 and a console
 * error.
 */
export function isUntracked(state: OrderCaptureState | null): boolean {
  return state === "draft" || state === "void";
}

/** The position of a tracker step id, 1 to 9, or null. */
export function positionOf(id: string): number | null {
  const at = SALES_STEP_IDS.findIndex((candidate) => candidate === id);
  return at >= 0 ? at + 1 : null;
}

const DAY_MS = 86_400_000;

/** Whole days from a date to today, both read as calendar days. Never below zero. */
export function ageInDays(orderDate: string, today: string): number {
  const from = Date.parse(`${orderDate.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  return Math.max(0, Math.round((to - from) / DAY_MS));
}
