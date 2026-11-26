import { describe, expect, it } from "vitest";
import type { NumberedPoVersionContent } from "./po-version-content.js";
import { PoVersionDiff } from "./po-version-diff.js";
import type { SalesOrderLineInput } from "./sales-order.js";

const line = (
  lineNo: number,
  itemNo: string,
  quantity = "5.000",
  unitPrice = "12.50",
  description = "Synthetic demo item",
): SalesOrderLineInput => ({
  lineNo,
  itemNo,
  description,
  quantity,
  unitPrice,
  qtyToShip: quantity,
});

const version = (
  poVersionNo: number,
  lines: SalesOrderLineInput[],
  over: Partial<NumberedPoVersionContent> = {},
): NumberedPoVersionContent => ({
  poVersionNo,
  orderDate: "2026-11-08",
  shipmentDate: null,
  currencyCode: "USD",
  prepaymentPercent: "30.00",
  lines,
  ...over,
});

const between = (
  from: NumberedPoVersionContent,
  to: NumberedPoVersionContent,
  comparePrices = true,
) => PoVersionDiff.between(from, to, { comparePrices });

describe("PoVersionDiff", () => {
  it("pairs lines by item number, never by line number", () => {
    const diff = between(
      version(1, [line(1, "I-1"), line(2, "I-2", "1.000")]),
      version(2, [line(1, "I-2", "1.000"), line(2, "I-1")]),
    );
    expect(diff.lines.map((l) => [l.itemNo, l.status])).toEqual([
      ["I-2", "unchanged"],
      ["I-1", "unchanged"],
    ]);
    expect(diff.lines.every((l) => l.moved)).toBe(true);
  });

  it("pairs a repeated item by order of occurrence and leaves the extras added or removed", () => {
    const earlier = version(1, [
      line(1, "I-1", "2.000"),
      line(2, "I-1", "3.000"),
    ]);
    const later = version(2, [
      line(1, "I-1", "2.000"),
      line(2, "I-1", "3.000"),
      line(3, "I-1", "4.000"),
    ]);
    const grown = between(earlier, later);
    expect(grown.lines.map((l) => l.status)).toEqual([
      "unchanged",
      "unchanged",
      "added",
    ]);
    const shrunk = between(later, earlier);
    expect(shrunk.lines.map((l) => l.status)).toEqual([
      "unchanged",
      "unchanged",
      "removed",
    ]);
  });

  it("reports a changed quantity as changed, with the numbers from and to", () => {
    const diff = between(
      version(1, [line(1, "I-1", "5.000")]),
      version(2, [line(1, "I-1", "8.000")]),
    );
    expect(diff.lines).toHaveLength(1);
    expect(diff.lines[0]).toMatchObject({
      status: "changed",
      quantityChanged: true,
      priceChanged: false,
      from: { quantity: "5.000" },
      to: { quantity: "8.000" },
    });
  });

  it("reports a changed price as changed when prices are compared", () => {
    const diff = between(
      version(1, [line(1, "I-1", "5.000", "12.50")]),
      version(2, [line(1, "I-1", "5.000", "13.00")]),
    );
    expect(diff.lines[0]).toMatchObject({
      status: "changed",
      priceChanged: true,
      quantityChanged: false,
    });
    expect(diff.total).toEqual({ from: "62.50", to: "65.00", changed: true });
    expect(diff.identical).toBe(false);
  });

  it("ignores a price difference when prices are not compared, so a price-only revision is unchanged and identical", () => {
    const diff = between(
      version(1, [line(1, "I-1", "5.000", "12.50")]),
      version(2, [line(1, "I-1", "5.000", "13.00")]),
      false,
    );
    expect(diff.pricesCompared).toBe(false);
    expect(diff.lines[0]).toMatchObject({
      status: "unchanged",
      priceChanged: false,
    });
    expect(diff.total.changed).toBe(false);
    expect(diff.identical).toBe(true);
    expect(diff.counts).toEqual({
      added: 0,
      removed: 0,
      changed: 0,
      moved: 0,
      unchanged: 1,
    });
  });

  it("reports an item only in the later version as added and one only in the earlier as removed", () => {
    const diff = between(
      version(1, [line(1, "I-1"), line(2, "I-2")]),
      version(2, [line(1, "I-1"), line(2, "I-3")]),
    );
    const added = diff.lines.find((l) => l.itemNo === "I-3");
    const removed = diff.lines.find((l) => l.itemNo === "I-2");
    expect(added).toMatchObject({ status: "added", from: null });
    expect(removed).toMatchObject({ status: "removed", to: null });
  });

  it("notes a moved line number without calling the line changed, and a pure move is not identical", () => {
    const diff = between(
      version(1, [line(1, "I-1"), line(2, "I-2")]),
      version(2, [line(1, "I-2"), line(2, "I-1")]),
    );
    expect(diff.lines.map((l) => [l.status, l.moved])).toEqual([
      ["unchanged", true],
      ["unchanged", true],
    ]);
    expect(diff.counts.moved).toBe(2);
    expect(diff.identical).toBe(false);
  });

  it("compares decimals as numbers: 5 and 5.000 are the same, and so are 12.5 and 12.50", () => {
    const diff = between(
      version(1, [line(1, "I-1", "5", "12.5")]),
      version(2, [line(1, "I-1", "5.000", "12.50")]),
    );
    expect(diff.lines[0]?.status).toBe("unchanged");
    expect(diff.identical).toBe(true);
  });

  it("does not compare the description or the quantity to ship", () => {
    const later = line(1, "I-1", "5.000", "12.50", "A reworded description");
    const diff = between(
      version(1, [line(1, "I-1")]),
      version(2, [{ ...later, qtyToShip: "1.000" }]),
    );
    expect(diff.identical).toBe(true);
    expect(diff.lines[0]?.status).toBe("unchanged");
  });

  it("compares the order date, the shipment date (null against a date is a change), the prepayment percent and the currency", () => {
    const lines = [line(1, "I-1")];
    const field = (diff: PoVersionDiff, name: string) =>
      diff.header.find((h) => h.field === name);
    const date = between(
      version(1, lines),
      version(2, lines, { orderDate: "2026-11-20" }),
    );
    expect(field(date, "orderDate")).toMatchObject({
      from: "2026-11-08",
      to: "2026-11-20",
      changed: true,
    });
    const ship = between(
      version(1, lines),
      version(2, lines, { shipmentDate: "2026-12-01" }),
    );
    expect(field(ship, "shipmentDate")).toMatchObject({
      from: null,
      to: "2026-12-01",
      changed: true,
    });
    const back = between(
      version(1, lines, { shipmentDate: "2026-12-01" }),
      version(2, lines),
    );
    expect(field(back, "shipmentDate")?.changed).toBe(true);
    const percent = between(
      version(1, lines, { prepaymentPercent: "30.00" }),
      version(2, lines, { prepaymentPercent: "100.00" }),
    );
    expect(field(percent, "prepaymentPercent")?.changed).toBe(true);
    const same = between(
      version(1, lines, { prepaymentPercent: "30" }),
      version(2, lines, { prepaymentPercent: "30.00" }),
    );
    expect(field(same, "prepaymentPercent")?.changed).toBe(false);
    const currency = between(
      version(1, lines),
      version(2, lines, { currencyCode: "EUR" }),
    );
    expect(field(currency, "currencyCode")?.changed).toBe(true);
    expect(date.header.map((h) => h.field)).toEqual([
      "orderDate",
      "shipmentDate",
      "prepaymentPercent",
      "currencyCode",
    ]);
  });

  it("works out each side's total from its lines, to the cent", () => {
    const diff = between(
      version(1, [line(1, "I-1", "1.500", "0.33"), line(2, "I-2", "2", "1")]),
      version(2, [line(1, "I-1", "3.000", "0.33")]),
    );
    // 1.5 x 0.33 is 0.495, so 0.50 for the line, and the second line adds 2.00.
    expect(diff.total).toEqual({ from: "2.50", to: "0.99", changed: true });
  });

  it("names the changed header fields and never the total", () => {
    const diff = between(
      version(1, [line(1, "I-1", "5.000", "12.50")]),
      version(2, [line(1, "I-1", "8.000", "13.00")], {
        orderDate: "2026-11-20",
        prepaymentPercent: "50.00",
      }),
    );
    expect(diff.changedHeaderFields).toEqual([
      "orderDate",
      "prepaymentPercent",
    ]);
    expect(diff.changedHeaderFields).not.toContain("total");
  });

  it("puts removed lines last and the others in the later version's line order", () => {
    const diff = between(
      version(1, [line(1, "I-1"), line(2, "I-2"), line(3, "I-3")]),
      version(2, [line(1, "I-4"), line(2, "I-3"), line(3, "I-1")]),
    );
    expect(diff.lines.map((l) => [l.itemNo, l.status])).toEqual([
      ["I-4", "added"],
      ["I-3", "unchanged"],
      ["I-1", "unchanged"],
      ["I-2", "removed"],
    ]);
  });

  it("counts added, removed, changed, moved and unchanged", () => {
    const diff = between(
      version(1, [line(1, "I-1"), line(2, "I-2"), line(3, "I-3", "1.000")]),
      version(2, [line(1, "I-2"), line(2, "I-3", "2.000"), line(3, "I-4")]),
    );
    expect(diff.counts).toEqual({
      added: 1,
      removed: 1,
      changed: 1,
      moved: 2,
      unchanged: 1,
    });
  });

  it("is identical only when no header field, line or line position differs", () => {
    const lines = [line(1, "I-1"), line(2, "I-2")];
    expect(between(version(1, lines), version(2, lines)).identical).toBe(true);
    expect(
      between(
        version(1, lines),
        version(2, lines, { shipmentDate: "2026-12-01" }),
      ).identical,
    ).toBe(false);
    expect(
      between(version(1, lines), version(2, [line(1, "I-1")])).identical,
    ).toBe(false);
    expect(
      between(version(1, lines), version(2, [line(1, "I-2"), line(2, "I-1")]))
        .identical,
    ).toBe(false);
  });
});
