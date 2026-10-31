import { Inject, Injectable } from "@nestjs/common";
import type {
  OrderTimeline,
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
    const reported = await this.statuses.statusOfMany(
      orders.map((o) => o.header.no),
    );
    const openByOrder = new Map<string, number>();
    for (const exception of this.repo.exceptions()) {
      openByOrder.set(
        exception.orderNo,
        (openByOrder.get(exception.orderNo) ?? 0) + 1,
      );
    }

    let rows = orders.flatMap((order): TrackerOrder[] => {
      const status = reported.get(order.header.no);
      if (!status) return [];
      return [
        {
          orderNo: order.header.no,
          externalDocumentNo: order.header.externalDocumentNo,
          customerNo: order.header.sellToCustomerNo,
          customerName: this.repo.customerName(order.header.sellToCustomerNo),
          status: status.status,
          ownerRole: status.ownerRole,
          overdue: mockOverdue(order),
          openExceptions: openByOrder.get(order.header.no) ?? 0,
          shipmentDate: order.header.shipmentDate,
          orderDate: order.header.orderDate,
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
    if (query.overdue) {
      const want = query.overdue === "true";
      rows = rows.filter((row) => row.overdue.overdue === want);
    }
    if (query.sort) {
      const key = SORT_KEY[query.sort];
      const sign = query.direction === "desc" ? -1 : 1;
      rows = [...rows].sort(
        (a, b) =>
          sign * key(a).localeCompare(key(b)) ||
          a.orderNo.localeCompare(b.orderNo),
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
      overdue: mockOverdue(order),
      steps: mockTimeline(order),
      checks: mockChecks(order),
      matches: mockMatches(order, this.repo.customers(), this.repo.items()),
    };
  }
}
