import { Inject, Injectable } from "@nestjs/common";
import type {
  PurchaseOrder,
  SampleOrder,
  VendorBankAccount,
} from "@orderpilot/synthetic-data";
import {
  SYNTHETIC_SOURCE,
  type DatasetSource,
} from "../../common/synthetic-source.js";
import { mockOverdue } from "../checks/domain/mock-samples.js";
import { sampleStepFor } from "../checks/domain/mock-status.js";
import type {
  MasterDataReader,
  MasterDataSalesOrder,
} from "./domain/master-data-reader.js";

function toSalesOrder(order: SampleOrder, asOf: string): MasterDataSalesOrder {
  const overdue = mockOverdue(order, asOf);
  return {
    no: order.header.no,
    customerNo: order.header.sellToCustomerNo,
    externalDocumentNo: order.header.externalDocumentNo,
    orderDate: order.header.orderDate,
    shipmentDate: order.header.shipmentDate,
    status: sampleStepFor(order.sampleScreenState).status.label,
    total: order.total,
    lines: order.lines,
    stockShortfall: order.stockShortfall,
    overdue: overdue.overdue
      ? { daysOverdue: overdue.daysOverdue, reason: overdue.reason ?? "" }
      : null,
  };
}

/**
 * The mock of Navision's master data, over the synthetic set. Status and
 * overdue come from the same mock builders as the tracker, so a customer's
 * overdue count equals the tracker's list. P-20's connector replaces this
 * class. It looks the set up on each call, because the set turns over daily.
 */
@Injectable()
export class MockNavisionMasterData implements MasterDataReader {
  constructor(
    @Inject(SYNTHETIC_SOURCE) private readonly source: DatasetSource,
  ) {}

  items() {
    return Promise.resolve(this.source().items);
  }

  customers() {
    return Promise.resolve(this.source().customers);
  }

  vendors() {
    return Promise.resolve(this.source().vendors);
  }

  vendorBankAccounts(vendorNo: string): Promise<readonly VendorBankAccount[]> {
    return Promise.resolve(
      this.source().vendorBankAccounts.filter(
        (account) => account.vendorNo === vendorNo,
      ),
    );
  }

  salesOrders(): Promise<readonly MasterDataSalesOrder[]> {
    const { orders, asOf } = this.source();
    return Promise.resolve(orders.map((order) => toSalesOrder(order, asOf)));
  }

  purchaseOrders(): Promise<readonly PurchaseOrder[]> {
    return Promise.resolve(this.source().purchaseOrders);
  }

  sprs() {
    return Promise.resolve(this.source().sprs);
  }
}
