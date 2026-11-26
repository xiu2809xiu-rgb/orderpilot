import { compareDecimal } from "@orderpilot/shared";
import {
  contentTotal,
  type NumberedPoVersionContent,
} from "./po-version-content.js";
import type { SalesOrderLineInput } from "./sales-order.js";

export type LineStatus = "added" | "removed" | "changed" | "unchanged";

export interface LineSide {
  readonly lineNo: number;
  readonly quantity: string;
  readonly unitPrice: string;
}

export interface LineDifference {
  readonly itemNo: string;
  readonly description: string;
  readonly from: LineSide | null;
  readonly to: LineSide | null;
  readonly quantityChanged: boolean;
  readonly priceChanged: boolean;
  readonly moved: boolean;
  readonly status: LineStatus;
}

export type HeaderField =
  "orderDate" | "shipmentDate" | "prepaymentPercent" | "currencyCode";

export interface HeaderDifference {
  readonly field: HeaderField;
  readonly from: string | null;
  readonly to: string | null;
  readonly changed: boolean;
}

const sideOf = (line: SalesOrderLineInput): LineSide => ({
  lineNo: line.lineNo,
  quantity: line.quantity,
  unitPrice: line.unitPrice,
});

/** The lines of one item, in line order: the k-th of one side pairs with the k-th of the other. */
function byItem(
  lines: readonly SalesOrderLineInput[],
): Map<string, SalesOrderLineInput[]> {
  const groups = new Map<string, SalesOrderLineInput[]>();
  for (const line of [...lines].sort((a, b) => a.lineNo - b.lineNo)) {
    const group = groups.get(line.itemNo) ?? [];
    group.push(line);
    groups.set(line.itemNo, group);
  }
  return groups;
}

/**
 * What changed between two PO versions of one order (ADR 0074 decision 8).
 * Lines pair by item number, never by line number. The description and the
 * quantity to ship are never compared. With `comparePrices` false, a price
 * never counts as a change, so a role that may not see prices learns of none
 * through a status, `identical` or a count.
 *
 * The class takes contents, and the view builder (`toDifferencesView`) is the
 * one caller that decides `comparePrices`, from the role.
 */
export class PoVersionDiff {
  readonly fromPoVersionNo: number;
  readonly toPoVersionNo: number;
  readonly header: readonly HeaderDifference[];
  readonly total: {
    readonly from: string;
    readonly to: string;
    readonly changed: boolean;
  };
  readonly lines: readonly LineDifference[];
  readonly pricesCompared: boolean;

  private constructor(
    from: NumberedPoVersionContent,
    to: NumberedPoVersionContent,
    comparePrices: boolean,
  ) {
    this.fromPoVersionNo = from.poVersionNo;
    this.toPoVersionNo = to.poVersionNo;
    this.pricesCompared = comparePrices;
    this.header = [
      differ("orderDate", from.orderDate, to.orderDate),
      differ("shipmentDate", from.shipmentDate, to.shipmentDate),
      {
        field: "prepaymentPercent",
        from: from.prepaymentPercent,
        to: to.prepaymentPercent,
        changed:
          compareDecimal(from.prepaymentPercent, to.prepaymentPercent) !== 0,
      },
      differ("currencyCode", from.currencyCode, to.currencyCode),
    ];
    const totalFrom = contentTotal(from);
    const totalTo = contentTotal(to);
    this.total = {
      from: totalFrom,
      to: totalTo,
      changed: comparePrices && compareDecimal(totalFrom, totalTo) !== 0,
    };
    this.lines = pairLines(from, to, comparePrices);
  }

  static between(
    from: NumberedPoVersionContent,
    to: NumberedPoVersionContent,
    options: { comparePrices: boolean },
  ): PoVersionDiff {
    return new PoVersionDiff(from, to, options.comparePrices);
  }

  /** No header field, line or line position differs. */
  get identical(): boolean {
    return (
      this.header.every((field) => !field.changed) &&
      this.lines.every((line) => line.status === "unchanged" && !line.moved)
    );
  }

  /** The names of the header fields that changed. The total is derived, so it is never named. */
  get changedHeaderFields(): HeaderField[] {
    return this.header.filter((field) => field.changed).map((f) => f.field);
  }

  get counts(): {
    added: number;
    removed: number;
    changed: number;
    moved: number;
    unchanged: number;
  } {
    const count = (status: LineStatus): number =>
      this.lines.filter((line) => line.status === status).length;
    return {
      added: count("added"),
      removed: count("removed"),
      changed: count("changed"),
      moved: this.lines.filter((line) => line.moved).length,
      unchanged: count("unchanged"),
    };
  }
}

function differ(
  field: HeaderField,
  from: string | null,
  to: string | null,
): HeaderDifference {
  return { field, from, to, changed: from !== to };
}

function pairLines(
  from: NumberedPoVersionContent,
  to: NumberedPoVersionContent,
  comparePrices: boolean,
): LineDifference[] {
  const before = byItem(from.lines);
  const after = byItem(to.lines);
  const matchedAndAdded: LineDifference[] = [];
  const removed: LineDifference[] = [];
  for (const [itemNo, later] of after) {
    const earlier = before.get(itemNo) ?? [];
    later.forEach((line, k) => {
      const old = earlier[k];
      if (!old) {
        matchedAndAdded.push({
          itemNo,
          description: line.description,
          from: null,
          to: sideOf(line),
          quantityChanged: false,
          priceChanged: false,
          moved: false,
          status: "added",
        });
        return;
      }
      const quantityChanged = compareDecimal(old.quantity, line.quantity) !== 0;
      const priceChanged =
        comparePrices && compareDecimal(old.unitPrice, line.unitPrice) !== 0;
      matchedAndAdded.push({
        itemNo,
        description: line.description,
        from: sideOf(old),
        to: sideOf(line),
        quantityChanged,
        priceChanged,
        moved: old.lineNo !== line.lineNo,
        status: quantityChanged || priceChanged ? "changed" : "unchanged",
      });
    });
  }
  for (const [itemNo, earlier] of before) {
    const left = (after.get(itemNo) ?? []).length;
    for (const old of earlier.slice(left))
      removed.push({
        itemNo,
        description: old.description,
        from: sideOf(old),
        to: null,
        quantityChanged: false,
        priceChanged: false,
        moved: false,
        status: "removed",
      });
  }
  matchedAndAdded.sort((a, b) => (a.to?.lineNo ?? 0) - (b.to?.lineNo ?? 0));
  removed.sort((a, b) => (a.from?.lineNo ?? 0) - (b.from?.lineNo ?? 0));
  return [...matchedAndAdded, ...removed];
}
