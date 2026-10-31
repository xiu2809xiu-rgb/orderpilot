import type { CheckCompleted, ReportedStatus, Role } from "@orderpilot/shared";

/** What area 2 reports about one order. Area 3 shows it and computes nothing from it. */
export interface ReportedOrderStatus {
  readonly orderNo: string;
  readonly status: ReportedStatus;
  /** Who holds the order's current task. */
  readonly ownerRole: Role;
  /** When the order entered this status. */
  readonly since: string;
}

/**
 * The only way area 3 learns an order's status. Order status lives in area
 * 2's state machine, so this is a port: today a mock implementation answers
 * from the synthetic data's sample states, and area 2's API replaces it with
 * a class that reads the real thing. Nothing in area 3 branches on a status
 * code.
 */
export interface OrderStatusReader {
  statusOf(orderNo: string): Promise<ReportedOrderStatus | null>;
  statusOfMany(
    orderNos: readonly string[],
  ): Promise<ReadonlyMap<string, ReportedOrderStatus>>;
}

/** The injection token for the reader (an interface has no runtime value). */
export const ORDER_STATUS_READER = Symbol("ORDER_STATUS_READER");

/**
 * Area 3 reports a finished check to area 2 through this port, so the
 * direction is in the code: area 3 gives `check.completed`, and area 2
 * decides what it means. The base provides no implementation.
 */
export interface CheckReporter {
  report(completed: CheckCompleted): Promise<void>;
}

export const CHECK_REPORTER = Symbol("CHECK_REPORTER");
