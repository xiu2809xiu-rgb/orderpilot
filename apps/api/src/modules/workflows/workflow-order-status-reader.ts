import { Inject, Injectable } from "@nestjs/common";
import type { OrderStatus } from "@orderpilot/shared";
import type {
  OrderStatusReader,
  ReportedOrderStatus,
} from "../checks/domain/order-status-reader.js";
import {
  OrderWorkflowService,
  type OrderStatusView,
} from "./order-workflow.service.js";

const STATUS_LABELS: Readonly<Record<OrderStatus, string>> = {
  Received: "PO received",
  Confirmed: "Fields confirmed",
  StockChecked: "Stock checked",
  AwaitingSpr: "Waiting for SPR approval",
  SprApproved: "SPR approved",
  AwaitingPayment: "Waiting for payment",
  Paid: "Paid",
  Packing: "Packing",
  Invoiced: "Invoiced",
  Released: "Released to the forwarder",
  AwaitingShippingDocuments: "Waiting for shipping documents",
  Closed: "Closed",
  OnHold: "On hold",
  Cancelled: "Cancelled",
};

function reportOf(view: OrderStatusView): ReportedOrderStatus {
  return {
    orderNo: view.orderRef,
    status: { code: view.status, label: STATUS_LABELS[view.status] },
    // A finished order waits on nobody. Support is who a question about it goes to.
    ownerRole: view.ownerRole ?? "SUPPORT",
    since: view.since.toISOString(),
    open: view.open,
  };
}

/**
 * Area 3's port for reading status, answered from the state machine. Area 3
 * binds it in place of its mock when it is ready. A seeded sample answers null,
 * because the machine never ran it, so the tracker needs a fallback until the
 * demo's orders run on the machine.
 */
@Injectable()
export class WorkflowOrderStatusReader implements OrderStatusReader {
  constructor(
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
  ) {}

  async statusOf(orderNo: string): Promise<ReportedOrderStatus | null> {
    const view = await this.workflow.statusOf(orderNo);
    return view ? reportOf(view) : null;
  }

  async statusOfMany(
    orderNos: readonly string[],
  ): Promise<ReadonlyMap<string, ReportedOrderStatus>> {
    const views = await this.workflow.statusOfMany(orderNos);
    return new Map([...views].map(([no, view]) => [no, reportOf(view)]));
  }
}
