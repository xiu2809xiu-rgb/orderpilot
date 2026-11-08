import { Inject, Injectable } from "@nestjs/common";
import type { SampleOrder, SyntheticDataset } from "@orderpilot/synthetic-data";
import {
  SYNTHETIC_SOURCE,
  type DatasetSource,
} from "../../../common/synthetic-source.js";
import { mockOverdue } from "../../checks/domain/mock-samples.js";
import { sampleStepFor } from "../../checks/domain/mock-status.js";
import { lateStep } from "../../master-data/mock-navision-master-data.js";
import type { OrderFactsSource } from "../domain/order-directory.js";
import type { OrderFacts } from "../domain/order-facts.js";

function toFacts(order: SampleOrder, dataset: SyntheticDataset): OrderFacts {
  const overdue = mockOverdue(order, dataset.asOf);
  const shortfall = order.stockShortfall;
  const spr = dataset.sprs.find((s) => s.orderNo === order.header.no);
  return {
    orderNo: order.header.no,
    source: "sample",
    // A sample was never entered here, so it has no capture state to show.
    captureState: null,
    customerNo: order.header.sellToCustomerNo,
    customerName:
      dataset.customers.find((c) => c.no === order.header.sellToCustomerNo)
        ?.name ?? null,
    externalDocumentNo: order.header.externalDocumentNo,
    orderDate: order.header.orderDate,
    shipmentDate: order.header.shipmentDate,
    currencyCode: order.header.currencyCode,
    prepaymentPercent: order.header.prepaymentPercent,
    // A sample's number is the one Navision gives it.
    navisionNo: order.header.no,
    workflowStatus: sampleStepFor(order.sampleScreenState).status.label,
    total: order.total,
    lines: order.lines.map((line, index) => ({
      lineNo: index + 1,
      itemNo: line.no,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      qtyToShip: line.qtyToShip,
    })),
    stockShortfall: shortfall && {
      itemNo: shortfall.itemNo,
      ordered: shortfall.ordered,
      availableStock: shortfall.availableStock,
      shortBy: shortfall.shortBy,
      coveredBy: spr?.status === "approved" ? spr.navisionNo : null,
    },
    overdue:
      overdue.overdue && order.step.dueOn
        ? {
            daysOverdue: overdue.daysOverdue,
            step: lateStep(order),
            dueDate: order.step.dueOn,
          }
        : null,
  };
}

/**
 * The 120 sample orders, read from the synthetic set. They are never stored:
 * their dates move with today, so the set is looked up on each call.
 */
@Injectable()
export class SampleOrderSource implements OrderFactsSource {
  constructor(
    @Inject(SYNTHETIC_SOURCE) private readonly source: DatasetSource,
  ) {}

  list(): Promise<readonly OrderFacts[]> {
    const dataset = this.source();
    return Promise.resolve(
      dataset.orders.map((order) => toFacts(order, dataset)),
    );
  }

  find(orderNo: string): Promise<OrderFacts | null> {
    const dataset = this.source();
    const order = dataset.orders.find((o) => o.header.no === orderNo);
    return Promise.resolve(order ? toFacts(order, dataset) : null);
  }
}
