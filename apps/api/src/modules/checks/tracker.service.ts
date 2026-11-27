import { Inject, Injectable } from "@nestjs/common";
import type {
  OrderTimeline,
  SalesFlow,
  TrackerOrder,
  TrackerQuery,
} from "@orderpilot/shared";
import { NotFoundError } from "../../common/domain-error.js";
import {
  mockChecks,
  mockMatches,
  mockOverdue,
  mockTimeline,
} from "./domain/mock-samples.js";
import { MOCK_SALES_FLOW } from "./domain/mock-sales-flow.js";
import {
  ORDER_STATUS_READER,
  type OrderStatusReader,
} from "./domain/order-status-reader.js";
import { MockChecksRepository } from "./mock-checks.repository.js";

export interface TrackerPage {
  readonly items: readonly TrackerOrder[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

const SORT_KEY = {
  orderNo: (o: TrackerOrder) => o.orderNo,
  customerName: (o: TrackerOrder) => o.customerName,
  orderDate: (o: TrackerOrder) => o.orderDate,
  shipmentDate: (o: TrackerOrder) => o.shipmentDate ?? "",
} as const;

function comparer(column: NonNullable<TrackerQuery["sort"]>) {
  if (column === "amount") {
    return (a: TrackerOrder, b: TrackerOrder) =>
      Number(a.amount ?? 0) - Number(b.amount ?? 0);
  }
  const key = SORT_KEY[column];
  return (a: TrackerOrder, b: TrackerOrder) => key(a).localeCompare(key(b));
}

/**
 * The tracker's routes over mock data. Status and owner come from the
 * `OrderStatusReader` port (area 2's), overdue flags and the timeline from the
 * sample builders. This service pages, searches and sorts the list so the
 * data table works server-side; it keeps no status logic and decides no
 * overdue rule. Area 3 replaces the builders with a read model fed by
 * area 2's events (starter story D-4).
 */
@Injectable()
export class TrackerService {
  constructor(
    @Inject(MockChecksRepository) private readonly repo: MockChecksRepository,
    @Inject(ORDER_STATUS_READER) private readonly statuses: OrderStatusReader,
  ) {}

  async list(query: TrackerQuery): Promise<TrackerPage> {
    const orders = this.repo.orders();
    const asOf = this.repo.asOf();
    const reported = await this.statuses.statusOfMany(
      orders.map((o) => o.header.no),
    );
    const openByOrder = new Map<string, number>();
    for (const exception of this.repo.exceptions()) {
      if (exception.state !== "OPEN") continue;
      openByOrder.set(
        exception.orderNo,
        (openByOrder.get(exception.orderNo) ?? 0) + 1,
      );
    }

    let rows = orders.flatMap((order): TrackerOrder[] => {
      const status = reported.get(order.header.no);
      if (!status) return [];
      if (query.open && status.open !== (query.open === "true")) return [];
      if (query.documentToConfirm) {
        const waiting = order.documents.some((d) => d.status === "to-confirm");
        if (waiting !== (query.documentToConfirm === "true")) return [];
      }
      return [
        {
          orderNo: order.header.no,
          externalDocumentNo: order.header.externalDocumentNo,
          customerNo: order.header.sellToCustomerNo,
          customerName: this.repo.customerName(order.header.sellToCustomerNo),
          status: status.status,
          ownerRole: status.ownerRole,
          overdue: mockOverdue(order, asOf),
          openExceptions: openByOrder.get(order.header.no) ?? 0,
          shipmentDate: order.header.shipmentDate,
          orderDate: order.header.orderDate,
          amount: order.total,
          currencyCode: order.header.currencyCode,
        },
      ];
    });

    const search = query.search?.toLowerCase();
    if (search) {
      rows = rows.filter((row) =>
        [row.orderNo, row.externalDocumentNo, row.customerNo, row.customerName]
          .join(" ")
          .toLowerCase()
          .includes(search),
      );
    }
    if (query.status) {
      const wanted = new Set(query.status.split(","));
      rows = rows.filter((row) => wanted.has(row.status.code));
    }
    if (query.ownerRole) {
      rows = rows.filter((row) => row.ownerRole === query.ownerRole);
    }
    if (query.overdue) {
      const want = query.overdue === "true";
      rows = rows.filter((row) => row.overdue.overdue === want);
    }
    if (query.exceptionsOnly) {
      const want = query.exceptionsOnly === "true";
      rows = rows.filter((row) => row.openExceptions > 0 === want);
    }
    // Late orders first (the most late at the top), then the newest, unless
    // the screen asks for another order.
    rows = [...rows].sort(
      (a, b) =>
        b.overdue.daysOverdue - a.overdue.daysOverdue ||
        b.orderDate.localeCompare(a.orderDate) ||
        b.orderNo.localeCompare(a.orderNo),
    );
    if (query.sort) {
      const compare = comparer(query.sort);
      const sign = query.direction === "desc" ? -1 : 1;
      rows = [...rows].sort(
        (a, b) => sign * compare(a, b) || a.orderNo.localeCompare(b.orderNo),
      );
    }

    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total: rows.length,
    };
  }

  /** How many open orders sit at each step. A count only: it moves no order. */
  async flow(): Promise<SalesFlow> {
    const reported = await this.statuses.statusOfMany(
      this.repo.orders().map((o) => o.header.no),
    );
    const open = [...reported.values()].filter((order) => order.open);
    return {
      openOrders: open.length,
      steps: MOCK_SALES_FLOW.map((step) => ({
        id: step.id,
        statuses: [...step.statuses],
        count: open.filter((o) =>
          (step.statuses as readonly string[]).includes(o.status.code),
        ).length,
      })),
    };
  }

  async timeline(orderNo: string): Promise<OrderTimeline> {
    const order = this.repo.findOrder(orderNo);
    const status = order ? await this.statuses.statusOf(orderNo) : null;
    if (!order || !status) throw new NotFoundError("Order");
    return {
      orderNo,
      externalDocumentNo: order.header.externalDocumentNo,
      customerNo: order.header.sellToCustomerNo,
      customerName: this.repo.customerName(order.header.sellToCustomerNo),
      status: status.status,
      ownerRole: status.ownerRole,
      overdue: mockOverdue(order, this.repo.asOf()),
      steps: mockTimeline(order, this.repo.asOf()),
      checks: mockChecks(
        order,
        this.repo.asOf(),
        this.repo.customers(),
        this.repo.items(),
      ),
      matches: mockMatches(order, this.repo.customers(), this.repo.items()),
    };
  }
}
