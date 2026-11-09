import { Inject, Injectable } from "@nestjs/common";
import type { SampleOrder, SyntheticDataset } from "@orderpilot/synthetic-data";
import {
  SYNTHETIC_SOURCE,
  type DatasetSource,
} from "../../common/synthetic-source.js";
import { mockOverdue } from "../checks/domain/mock-samples.js";
import { sampleStepFor } from "../checks/domain/mock-status.js";
import type {
  MasterDataBankAccount,
  MasterDataCustomer,
  MasterDataItem,
  MasterDataPurchaseOrder,
  MasterDataReader,
  MasterDataSalesOrder,
  MasterDataSpr,
  MasterDataVendor,
} from "./domain/master-data-reader.js";

/** What is late: the transport document for an overdue AWB or bill of lading, else the step. */
export function lateStep(order: SampleOrder): string {
  const { scenario } = order;
  if (scenario.kind === "awb-overdue")
    return scenario.documentType === "AWB" ? "AWB" : "Bill of lading";
  return sampleStepFor(order.sampleScreenState).status.label;
}

function toSalesOrder(
  order: SampleOrder,
  dataset: SyntheticDataset,
): MasterDataSalesOrder {
  const overdue = mockOverdue(order, dataset.asOf);
  const shortfall = order.stockShortfall;
  const spr = dataset.sprs.find((s) => s.orderNo === order.header.no);
  return {
    no: order.header.no,
    customerNo: order.header.sellToCustomerNo,
    externalDocumentNo: order.header.externalDocumentNo,
    orderDate: order.header.orderDate,
    shipmentDate: order.header.shipmentDate,
    status: sampleStepFor(order.sampleScreenState).status.label,
    total: order.total,
    lines: order.lines.map((line) => ({
      no: line.no,
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
 * The mock of Business Central's master data, over the synthetic set, mapped to the
 * reader's own records. Status and overdue come from the same mock builders
 * as the tracker, so a customer's overdue count equals the tracker's list.
 * P-20's connector replaces this class. It looks the set up on each call,
 * because the set turns over daily.
 */
@Injectable()
export class MockBusinessCentralMasterData implements MasterDataReader {
  constructor(
    @Inject(SYNTHETIC_SOURCE) private readonly source: DatasetSource,
  ) {}

  items(): Promise<readonly MasterDataItem[]> {
    return Promise.resolve(
      this.source().items.map((item) => ({
        no: item.no,
        description: item.description,
        partNumber: item.partNumber,
        brand: item.brand,
        category: item.category,
        baseUnitOfMeasure: item.baseUnitOfMeasure,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        inventory: item.inventory,
        qtyOnSalesOrder: item.qtyOnSalesOrder,
        qtyOnPurchOrder: item.qtyOnPurchOrder,
        vendorNo: item.vendorNo,
        vendorItemNo: item.vendorItemNo,
      })),
    );
  }

  customers(): Promise<readonly MasterDataCustomer[]> {
    return Promise.resolve(
      this.source().customers.map((customer) => ({
        no: customer.no,
        name: customer.name,
        countryRegionCode: customer.countryRegionCode,
        currencyCode: customer.currencyCode,
        paymentTermsCode: customer.paymentTermsCode,
        customerPriceGroup: customer.customerPriceGroup,
        creditLimitLcy: customer.creditLimitLcy,
        balanceLcy: customer.balanceLcy,
      })),
    );
  }

  vendors(): Promise<readonly MasterDataVendor[]> {
    return Promise.resolve(
      this.source().vendors.map((vendor) => ({
        no: vendor.no,
        name: vendor.name,
        currencyCode: vendor.currencyCode,
        paymentTermsCode: vendor.paymentTermsCode,
        balanceLcy: vendor.balanceLcy,
      })),
    );
  }

  vendorBankAccounts(
    vendorNo: string,
  ): Promise<readonly MasterDataBankAccount[]> {
    return Promise.resolve(
      this.source()
        .vendorBankAccounts.filter((account) => account.vendorNo === vendorNo)
        .map((account) => ({
          code: account.code,
          name: account.name,
          bankAccountNo: account.bankAccountNo,
          swiftCode: account.swiftCode,
          iban: account.iban,
        })),
    );
  }

  salesOrders(): Promise<readonly MasterDataSalesOrder[]> {
    const dataset = this.source();
    return Promise.resolve(
      dataset.orders.map((order) => toSalesOrder(order, dataset)),
    );
  }

  purchaseOrders(): Promise<readonly MasterDataPurchaseOrder[]> {
    return Promise.resolve(
      this.source().purchaseOrders.map((po) => ({
        no: po.no,
        buyFromVendorNo: po.buyFromVendorNo,
        orderDate: po.orderDate,
        expectedReceiptDate: po.expectedReceiptDate,
        status: po.status,
        sprRecordNo: po.sprRecordNo,
        lines: po.lines.map((line) => ({
          no: line.no,
          outstandingQuantity: line.outstandingQuantity,
          unitCost: line.unitCost,
        })),
        total: po.total,
      })),
    );
  }

  sprs(): Promise<readonly MasterDataSpr[]> {
    return Promise.resolve(
      this.source().sprs.map((spr) => ({
        recordNo: spr.recordNo,
        navisionNo: spr.navisionNo,
        orderNo: spr.orderNo,
        status: spr.status,
        itemNo: spr.itemNo,
        quantity: spr.quantity,
        needBy: spr.needBy,
        requestedBy: spr.requestedBy,
      })),
    );
  }
}
