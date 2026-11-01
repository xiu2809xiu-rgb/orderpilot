import { Inject, Injectable } from "@nestjs/common";
import {
  ITEM_CATEGORY_CODES,
  addDecimal,
  compareDecimal,
  type CustomerDetail,
  type CustomerQuery,
  type CustomerRow,
  type ItemDetail,
  type ItemQuery,
  type ItemRow,
  type MaskedField,
  type MasterDataFilters,
  type Role,
  type VendorDetail,
  type VendorQuery,
  type VendorRow,
} from "@orderpilot/shared";
import { NotFoundError } from "../../common/domain-error.js";
import { SAMPLE_RULES, mask } from "../governance/domain/masking.js";
import {
  MASTER_DATA_READER,
  type MasterDataItem,
  type MasterDataPurchaseOrder,
  type MasterDataReader,
  type MasterDataSalesOrder,
  type MasterDataSpr,
} from "./domain/master-data-reader.js";
import { StockPosition, isOpenOrder } from "./domain/stock-position.js";

export interface MasterDataPage<Row> {
  readonly items: readonly Row[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

interface Paging {
  readonly page: number;
  readonly pageSize: number;
  readonly direction?: "asc" | "desc" | undefined;
}

type SortKey<Row> = (row: Row) => string | number;

function compare(a: string | number, b: string | number): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { numeric: true });
}

function paged<Row extends { no: string }>(
  rows: readonly Row[],
  query: Paging,
  key: SortKey<Row> | undefined,
): MasterDataPage<Row> {
  const sign = query.direction === "desc" ? -1 : 1;
  const sorted = key
    ? [...rows].sort(
        (a, b) =>
          sign * compare(key(a), key(b)) || a.no.localeCompare(b.no, "en"),
      )
    : rows;
  const start = (query.page - 1) * query.pageSize;
  return {
    items: sorted.slice(start, start + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total: rows.length,
  };
}

const matches = (search: string | undefined, values: readonly string[]) =>
  !search || values.join(" ").toLowerCase().includes(search.toLowerCase());

const ITEM_SORT: Record<NonNullable<ItemQuery["sort"]>, SortKey<ItemRow>> = {
  no: (row) => row.no,
  description: (row) => row.description,
  brand: (row) => row.brand,
  inventory: (row) => Number(row.inventory),
  qtyOnSalesOrder: (row) => Number(row.qtyOnSalesOrder),
  qtyOnPurchOrder: (row) => Number(row.qtyOnPurchOrder),
  availableStock: (row) => Number(row.availableStock),
  unitPrice: (row) => Number(row.unitPrice.value ?? 0),
};

const CUSTOMER_SORT: Record<
  NonNullable<CustomerQuery["sort"]>,
  SortKey<CustomerRow>
> = {
  no: (row) => row.no,
  name: (row) => row.name,
  openOrders: (row) => row.openOrders,
  overdueOrders: (row) => row.overdueOrders,
};

const VENDOR_SORT: Record<
  NonNullable<VendorQuery["sort"]>,
  SortKey<VendorRow>
> = {
  no: (row) => row.no,
  name: (row) => row.name,
  openPurchaseOrders: (row) => row.openPurchaseOrders,
  itemsSupplied: (row) => row.itemsSupplied,
  balanceLcy: (row) => Number(row.balanceLcy.value ?? 0),
};

const distinct = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((a, b) => a.localeCompare(b, "en"));

const sum = (values: readonly string[]): string =>
  values.reduce((total, value) => addDecimal(total, value), "0.00");

const isOpenPurchase = (po: MasterDataPurchaseOrder): boolean =>
  po.status === "open";

/** The state of the purchase order an SPR became, or null before it is approved. */
function purchaseStatus(
  navisionNo: string | null,
  purchaseOrders: readonly MasterDataPurchaseOrder[],
): MasterDataPurchaseOrder["status"] | null {
  if (!navisionNo) return null;
  return purchaseOrders.find((po) => po.no === navisionNo)?.status ?? null;
}

/** The open lines holding an item, each with why it is short, if it is. */
function orderLinesOf(
  itemNo: string,
  orders: readonly MasterDataSalesOrder[],
  stock: StockPosition,
  sprs: readonly MasterDataSpr[],
  purchaseOrders: readonly MasterDataPurchaseOrder[],
  customerName: (no: string) => string,
): ItemDetail["orderLines"] {
  return orders.flatMap((order) => {
    const line = order.lines.find(
      (candidate) =>
        candidate.no === itemNo && compareDecimal(candidate.qtyToShip, "0") > 0,
    );
    if (!line) return [];
    const shortfall =
      order.stockShortfall?.itemNo === itemNo ? order.stockShortfall : null;
    const spr = sprs.find((candidate) => candidate.orderNo === order.no);
    const heldOut = stock.isHeldOut(order);
    return [
      {
        orderNo: order.no,
        customerNo: order.customerNo,
        customerName: customerName(order.customerNo),
        orderDate: order.orderDate,
        shipmentDate: order.shipmentDate,
        status: order.status,
        quantity: line.qtyToShip,
        heldOut,
        shortfall: shortfall && {
          state: heldOut ? "waiting" : "covered",
          ordered: shortfall.ordered,
          availableStock: shortfall.availableStock,
          shortBy: shortfall.shortBy,
          sprRecordNo: spr?.recordNo ?? null,
          purchaseOrderNo: shortfall.coveredBy,
          purchaseOrderStatus: purchaseStatus(
            shortfall.coveredBy,
            purchaseOrders,
          ),
        },
      },
    ];
  });
}

/**
 * The master data pages: read-only, paged, filtered and sorted here, and
 * masked here, so a hidden value never reaches the page or the network tab.
 * Everything comes through `MasterDataReader`. Records are matched on their
 * numbers and never on their names.
 */
@Injectable()
export class MasterDataService {
  constructor(
    @Inject(MASTER_DATA_READER) private readonly reader: MasterDataReader,
  ) {}

  private field(role: Role, field: string, value: string): MaskedField {
    return mask(SAMPLE_RULES, role, field, value);
  }

  private itemRow(
    item: MasterDataItem,
    orders: readonly MasterDataSalesOrder[],
    vendorName: string,
    role: Role,
  ): ItemRow {
    const stock = new StockPosition(item, orders);
    return {
      no: item.no,
      description: item.description,
      partNumber: item.partNumber,
      brand: item.brand,
      category: item.category,
      baseUnitOfMeasure: item.baseUnitOfMeasure,
      inventory: item.inventory,
      qtyOnSalesOrder: item.qtyOnSalesOrder,
      qtyOnPurchOrder: item.qtyOnPurchOrder,
      availableStock: stock.availableStock,
      availability: stock.availability,
      unitPrice: this.field(role, "item.unitPrice", item.unitPrice),
      vendorNo: item.vendorNo,
      vendorName,
    };
  }

  private async vendorNames(): Promise<ReadonlyMap<string, string>> {
    const vendors = await this.reader.vendors();
    return new Map(vendors.map((vendor) => [vendor.no, vendor.name]));
  }

  async listItems(
    query: ItemQuery,
    role: Role,
  ): Promise<MasterDataPage<ItemRow>> {
    const [items, orders, names] = await Promise.all([
      this.reader.items(),
      this.reader.salesOrders(),
      this.vendorNames(),
    ]);
    const rows = items
      .filter(
        (item) =>
          matches(query.search, [item.no, item.description, item.partNumber]) &&
          (!query.brand || item.brand === query.brand) &&
          (!query.category || item.category === query.category) &&
          (!query.vendor || item.vendorNo === query.vendor),
      )
      .map((item) =>
        this.itemRow(item, orders, names.get(item.vendorNo) ?? "", role),
      )
      .filter(
        (row) => !query.availability || row.availability === query.availability,
      );
    // Sorting by a value the role cannot see would reveal the order of the
    // hidden prices, so that sort falls back to the default order.
    const hidden = this.field(role, "item.unitPrice", "").masked;
    const sort = query.sort === "unitPrice" && hidden ? undefined : query.sort;
    return paged(rows, query, sort && ITEM_SORT[sort]);
  }

  async item(no: string, role: Role): Promise<ItemDetail> {
    const [items, orders, purchaseOrders, sprs, names, customers] =
      await Promise.all([
        this.reader.items(),
        this.reader.salesOrders(),
        this.reader.purchaseOrders(),
        this.reader.sprs(),
        this.vendorNames(),
        this.reader.customers(),
      ]);
    const item = items.find((candidate) => candidate.no === no);
    if (!item) throw new NotFoundError("Item");
    const customerNames = new Map(customers.map((c) => [c.no, c.name]));
    const itemSprs = sprs.filter((spr) => spr.itemNo === no);
    const orderLines = orderLinesOf(
      no,
      orders,
      new StockPosition(item, orders),
      itemSprs,
      purchaseOrders,
      (customerNo) => customerNames.get(customerNo) ?? "",
    );
    return {
      ...this.itemRow(item, orders, names.get(item.vendorNo) ?? "", role),
      vendorItemNo: item.vendorItemNo,
      unitCost: this.field(role, "item.unitCost", item.unitCost),
      orderLines,
      salesOrderBreakdown: {
        listed: sum(
          orderLines.filter((l) => !l.heldOut).map((l) => l.quantity),
        ),
        heldOut: sum(
          orderLines.filter((l) => l.heldOut).map((l) => l.quantity),
        ),
      },
      purchaseLines: purchaseOrders.filter(isOpenPurchase).flatMap((po) =>
        po.lines
          .filter((line) => line.no === no)
          .map((line) => ({
            purchaseOrderNo: po.no,
            orderDate: po.orderDate,
            expectedReceiptDate: po.expectedReceiptDate,
            outstandingQuantity: line.outstandingQuantity,
            unitCost: this.field(role, "item.unitCost", line.unitCost),
            sprRecordNo: po.sprRecordNo,
          })),
      ),
      sprs: itemSprs.map((spr) => ({
        recordNo: spr.recordNo,
        navisionNo: spr.navisionNo,
        purchaseOrderStatus: purchaseStatus(spr.navisionNo, purchaseOrders),
        orderNo: spr.orderNo,
        status: spr.status,
        quantity: spr.quantity,
        needBy: spr.needBy,
        requestedBy: spr.requestedBy,
      })),
    };
  }

  async listCustomers(
    query: CustomerQuery,
  ): Promise<MasterDataPage<CustomerRow>> {
    const [customers, orders] = await Promise.all([
      this.reader.customers(),
      this.reader.salesOrders(),
    ]);
    const rows = customers
      .filter(
        (customer) =>
          matches(query.search, [customer.no, customer.name]) &&
          (!query.country || customer.countryRegionCode === query.country) &&
          (!query.paymentTerms ||
            customer.paymentTermsCode === query.paymentTerms) &&
          (!query.priceGroup ||
            customer.customerPriceGroup === query.priceGroup),
      )
      .map((customer): CustomerRow => {
        const own = orders.filter((o) => o.customerNo === customer.no);
        return {
          no: customer.no,
          name: customer.name,
          countryRegionCode: customer.countryRegionCode,
          currencyCode: customer.currencyCode,
          paymentTermsCode: customer.paymentTermsCode,
          customerPriceGroup: customer.customerPriceGroup,
          openOrders: own.filter(isOpenOrder).length,
          overdueOrders: own.filter((o) => o.overdue).length,
        };
      });
    return paged(rows, query, query.sort && CUSTOMER_SORT[query.sort]);
  }

  async customer(no: string, role: Role): Promise<CustomerDetail> {
    const [customers, orders] = await Promise.all([
      this.reader.customers(),
      this.reader.salesOrders(),
    ]);
    const customer = customers.find((candidate) => candidate.no === no);
    if (!customer) throw new NotFoundError("Customer");
    const own = orders.filter((order) => order.customerNo === no);
    return {
      no: customer.no,
      name: customer.name,
      countryRegionCode: customer.countryRegionCode,
      currencyCode: customer.currencyCode,
      paymentTermsCode: customer.paymentTermsCode,
      customerPriceGroup: customer.customerPriceGroup,
      creditLimitLcy: this.field(
        role,
        "customer.creditLimitLcy",
        customer.creditLimitLcy,
      ),
      balanceLcy: this.field(role, "customer.balanceLcy", customer.balanceLcy),
      openOrders: own.filter(isOpenOrder).map((order) => ({
        orderNo: order.no,
        externalDocumentNo: order.externalDocumentNo,
        orderDate: order.orderDate,
        shipmentDate: order.shipmentDate,
        status: order.status,
        amount: this.field(role, "item.unitPrice", order.total),
      })),
      overdueOrders: own.flatMap((order) =>
        order.overdue
          ? [
              {
                orderNo: order.no,
                externalDocumentNo: order.externalDocumentNo,
                daysOverdue: order.overdue.daysOverdue,
                step: order.overdue.step,
                dueDate: order.overdue.dueDate,
              },
            ]
          : [],
      ),
    };
  }

  async listVendors(
    query: VendorQuery,
    role: Role,
  ): Promise<MasterDataPage<VendorRow>> {
    const [vendors, items, purchaseOrders] = await Promise.all([
      this.reader.vendors(),
      this.reader.items(),
      this.reader.purchaseOrders(),
    ]);
    const rows = vendors
      .filter((vendor) => matches(query.search, [vendor.no, vendor.name]))
      .map((vendor): VendorRow => ({
        no: vendor.no,
        name: vendor.name,
        currencyCode: vendor.currencyCode,
        paymentTermsCode: vendor.paymentTermsCode,
        openPurchaseOrders: purchaseOrders.filter(
          (po) => isOpenPurchase(po) && po.buyFromVendorNo === vendor.no,
        ).length,
        itemsSupplied: items.filter((i) => i.vendorNo === vendor.no).length,
        balanceLcy: this.field(role, "vendor.balanceLcy", vendor.balanceLcy),
      }));
    // As with prices: a sort by a hidden balance would give its order away.
    const hidden = this.field(role, "vendor.balanceLcy", "").masked;
    const sort = query.sort === "balanceLcy" && hidden ? undefined : query.sort;
    return paged(rows, query, sort && VENDOR_SORT[sort]);
  }

  async vendor(no: string, role: Role): Promise<VendorDetail> {
    const [vendors, items, purchaseOrders, orders] = await Promise.all([
      this.reader.vendors(),
      this.reader.items(),
      this.reader.purchaseOrders(),
      this.reader.salesOrders(),
    ]);
    const vendor = vendors.find((candidate) => candidate.no === no);
    if (!vendor) throw new NotFoundError("Vendor");
    const accounts = await this.reader.vendorBankAccounts(no);
    return {
      no: vendor.no,
      name: vendor.name,
      currencyCode: vendor.currencyCode,
      paymentTermsCode: vendor.paymentTermsCode,
      balanceLcy: this.field(role, "vendor.balanceLcy", vendor.balanceLcy),
      bankAccounts: accounts.map((account) => ({
        code: account.code,
        bankName: this.field(role, "vendor.bankName", account.name),
        bankAccountNo: this.field(
          role,
          "vendor.bankAccountNo",
          account.bankAccountNo,
        ),
        swiftCode: this.field(role, "vendor.swiftCode", account.swiftCode),
        iban: this.field(role, "vendor.iban", account.iban),
      })),
      openPurchaseOrders: purchaseOrders
        .filter((po) => isOpenPurchase(po) && po.buyFromVendorNo === no)
        .map((po) => ({
          no: po.no,
          orderDate: po.orderDate,
          expectedReceiptDate: po.expectedReceiptDate,
          lines: po.lines.length,
          outstandingQuantity: sum(
            po.lines.map((line) => line.outstandingQuantity),
          ),
          total: this.field(role, "item.unitCost", po.total),
          sprRecordNo: po.sprRecordNo,
        })),
      items: items
        .filter((item) => item.vendorNo === no)
        .map((item) => {
          const stock = new StockPosition(item, orders);
          return {
            no: item.no,
            description: item.description,
            vendorItemNo: item.vendorItemNo,
            availableStock: stock.availableStock,
            availability: stock.availability,
          };
        }),
    };
  }

  async filters(): Promise<MasterDataFilters> {
    const [items, customers, vendors] = await Promise.all([
      this.reader.items(),
      this.reader.customers(),
      this.reader.vendors(),
    ]);
    return {
      brands: distinct(items.map((item) => item.brand)),
      categories: [...ITEM_CATEGORY_CODES],
      vendors: vendors.map((vendor) => ({ no: vendor.no, name: vendor.name })),
      countries: distinct(customers.map((c) => c.countryRegionCode)),
      paymentTerms: distinct(customers.map((c) => c.paymentTermsCode)),
      priceGroups: distinct(customers.map((c) => c.customerPriceGroup)),
    };
  }
}
