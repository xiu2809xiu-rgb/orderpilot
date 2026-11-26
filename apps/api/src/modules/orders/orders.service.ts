import { Inject, Injectable } from "@nestjs/common";
import {
  addDecimal,
  lineAmount,
  type Role,
  type SalesOrderDetail,
  type SalesOrderQuery,
  type SalesOrderRow,
  type SalesOrderShortage,
} from "@orderpilot/shared";
import { NotFoundError } from "../../common/domain-error.js";
import { CustomerLookup } from "../master-data/customer-lookup.js";
import { StockLookup } from "../master-data/stock-lookup.js";
import { WorkflowOrderStatusReader } from "../workflows/workflow-order-status-reader.js";
import {
  ORDER_DIRECTORY,
  type OrderDirectory,
} from "./domain/order-directory.js";
import type { OrderEntry } from "./domain/order-entry.js";
import type { OrderFacts } from "./domain/order-facts.js";
import { filterOrders } from "./domain/order-filter.js";
import { OrderMasking } from "./domain/order-masking.js";
import { sortOrders } from "./domain/order-sorter.js";
import { ShortageCalculator } from "./domain/shortage-calculator.js";

export interface OrderPage {
  readonly items: readonly SalesOrderRow[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/**
 * A sample waiting on its SPR is short; one an approved SPR covers is not.
 * The figures are written the way the calculator writes a stored order's, so
 * the API gives one format for both kinds.
 */
function sampleShortages(facts: OrderFacts): SalesOrderShortage[] {
  const gap = facts.stockShortfall;
  if (gap?.coveredBy !== null) return [];
  return [
    {
      itemNo: gap.itemNo,
      ordered: addDecimal(gap.ordered, "0"),
      availableStock: addDecimal(gap.availableStock, "0"),
      shortBy: addDecimal(gap.shortBy, "0"),
    },
  ];
}

/**
 * The Orders list and reader. Paged, filtered, sorted and masked here, so a
 * hidden amount never reaches the page or the network tab. Every order comes
 * through `OrderDirectory`. Nothing here orders stock: a shortage is only
 * shown, and a person decides what to do about it.
 */
@Injectable()
export class OrdersService {
  constructor(
    @Inject(ORDER_DIRECTORY) private readonly directory: OrderDirectory,
    @Inject(StockLookup) private readonly stock: StockLookup,
    @Inject(CustomerLookup) private readonly customers: CustomerLookup,
    @Inject(OrderMasking) private readonly masking: OrderMasking,
    @Inject(WorkflowOrderStatusReader)
    private readonly workflow: WorkflowOrderStatusReader,
  ) {}

  /** Stored orders are judged against stock here, because the directory knows no stock. */
  private async entries(orders: readonly OrderFacts[]): Promise<OrderEntry[]> {
    // A void order wants nothing, so it is never short.
    const live = new Set(
      orders.filter((o) => o.source === "stored" && o.captureState !== "void"),
    );
    const itemNos = [...live].flatMap((o) => o.lines.map((l) => l.itemNo));
    const calculator = new ShortageCalculator(
      itemNos.length > 0
        ? await this.stock.availableStockOf(itemNos)
        : new Map(),
    );
    return orders.map((facts) => {
      if (facts.source === "sample")
        return { facts, shortages: sampleShortages(facts) };
      return {
        facts,
        shortages: live.has(facts) ? calculator.of(facts.lines) : [],
      };
    });
  }

  /**
   * Area 2's label for the submitted stored orders among these entries, null
   * where its workflow holds none (ADR 0073). Area 1 only reads. It runs on
   * the page being shown, after filter, sort and paging, because nothing
   * filters or sorts on the label, so the one query is bounded by the page
   * size. It must not run before `entries` builds its set of live orders,
   * which compares the facts objects themselves.
   */
  private async withWorkflow(
    entries: readonly OrderEntry[],
  ): Promise<OrderEntry[]> {
    const submitted = entries
      .filter(
        ({ facts }) =>
          facts.source === "stored" && facts.captureState === "submitted",
      )
      .map(({ facts }) => facts.orderNo);
    if (submitted.length === 0) return [...entries];
    const held = await this.workflow.statusOfMany(submitted);
    return entries.map((entry) =>
      entry.facts.source === "stored" &&
      entry.facts.captureState === "submitted"
        ? {
            ...entry,
            facts: {
              ...entry.facts,
              workflowStatus:
                held.get(entry.facts.orderNo)?.status.label ?? null,
            },
          }
        : entry,
    );
  }

  /** The names of the customers on the rows being shown, from master data by number. */
  private namesFor(
    entries: readonly OrderEntry[],
  ): Promise<ReadonlyMap<string, string>> {
    const missing = entries
      .filter((e) => e.facts.customerName === null)
      .map((e) => e.facts.customerNo);
    return missing.length > 0
      ? this.customers.namesOf(missing)
      : Promise.resolve(new Map());
  }

  private row(
    entry: OrderEntry,
    role: Role,
    names: ReadonlyMap<string, string>,
  ): SalesOrderRow {
    const { facts, shortages } = entry;
    return {
      orderNo: facts.orderNo,
      source: facts.source,
      captureState: facts.captureState,
      customerNo: facts.customerNo,
      customerName: facts.customerName ?? names.get(facts.customerNo) ?? null,
      externalDocumentNo: facts.externalDocumentNo,
      orderDate: facts.orderDate,
      shipmentDate: facts.shipmentDate,
      workflowStatus: facts.workflowStatus,
      amount: this.masking.amount(role, facts.total),
      currencyCode: facts.currencyCode,
      shortage: shortages[0] ?? null,
      shortageCount: shortages.length,
    };
  }

  async list(query: SalesOrderQuery, role: Role): Promise<OrderPage> {
    const canSeeAmount = this.masking.canSeeAmount(role);
    const all = await this.entries(
      await this.directory.list({ source: query.source }),
    );
    const found = sortOrders(
      filterOrders(all, query, canSeeAmount),
      query,
      canSeeAmount,
    );
    const start = (query.page - 1) * query.pageSize;
    const shown = await this.withWorkflow(
      found.slice(start, start + query.pageSize),
    );
    const names = await this.namesFor(shown);
    return {
      items: shown.map((entry) => this.row(entry, role, names)),
      page: query.page,
      pageSize: query.pageSize,
      total: found.length,
    };
  }

  async one(orderNo: string, role: Role): Promise<SalesOrderDetail> {
    const facts = await this.directory.find(orderNo);
    if (!facts) throw new NotFoundError("Order");
    const [bare] = await this.entries([facts]);
    if (!bare) throw new NotFoundError("Order");
    const [entry] = await this.withWorkflow([bare]);
    if (!entry) throw new NotFoundError("Order");
    const short = new Map(entry.shortages.map((s) => [s.itemNo, s.shortBy]));
    const names = await this.namesFor([entry]);
    return {
      ...this.row(entry, role, names),
      prepaymentPercent: facts.prepaymentPercent,
      navisionNo: facts.navisionNo,
      version: facts.version,
      lines: facts.lines.map((line) => ({
        lineNo: line.lineNo,
        itemNo: line.itemNo,
        description: line.description,
        quantity: line.quantity,
        qtyToShip: line.qtyToShip,
        unitPrice: this.masking.amount(role, line.unitPrice),
        lineAmount: this.masking.amount(
          role,
          lineAmount(line.quantity, line.unitPrice) ?? "0.00",
        ),
        shortBy: short.get(line.itemNo) ?? null,
      })),
    };
  }
}
