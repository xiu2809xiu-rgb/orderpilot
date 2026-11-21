import type { OrderTimeline, SalesOrderDetail } from "@orderpilot/shared";

/** An order entered here that the tracker does not know yet: no events, no checks, no journey. */
export function untracked(detail: SalesOrderDetail): OrderTimeline {
  return {
    orderNo: detail.orderNo,
    externalDocumentNo: detail.externalDocumentNo,
    customerNo: detail.customerNo,
    customerName: detail.customerName ?? detail.customerNo,
    status: { code: "none", label: "" },
    ownerRole: "SUPPORT",
    overdue: { overdue: false, daysOverdue: 0, reason: null },
    steps: [],
    checks: [],
    matches: [],
  };
}
