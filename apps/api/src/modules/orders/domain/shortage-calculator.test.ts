import { describe, expect, it } from "vitest";
import type { OrderFactsLine } from "./order-facts.js";
import { ShortageCalculator } from "./shortage-calculator.js";

function line(itemNo: string, quantity: string, lineNo = 1): OrderFactsLine {
  return {
    lineNo,
    itemNo,
    description: "Synthetic demo item",
    quantity,
    unitPrice: "10.00",
    qtyToShip: quantity,
  };
}

const stock = new Map([
  ["I-0001", "10"],
  ["I-0002", "100"],
  ["I-0003", "5"],
]);

describe("ShortageCalculator", () => {
  it("adds up two lines for one item before it compares", () => {
    const result = new ShortageCalculator(stock).of([
      line("I-0001", "6", 1),
      line("I-0001", "7", 2),
    ]);
    expect(result).toEqual([
      {
        itemNo: "I-0001",
        ordered: "13.00",
        availableStock: "10",
        shortBy: "3.00",
      },
    ]);
  });

  it("finds nothing short when stock covers the order, to the last unit", () => {
    expect(
      new ShortageCalculator(stock).of([
        line("I-0001", "10"),
        line("I-0002", "99"),
      ]),
    ).toEqual([]);
  });

  it("lists the largest gap first and breaks a tie by item number", () => {
    const result = new ShortageCalculator(stock).of([
      line("I-0003", "9", 1),
      line("I-0001", "14", 2),
      line("I-0002", "104", 3),
    ]);
    expect(result.map((s) => s.itemNo)).toEqual(["I-0001", "I-0002", "I-0003"]);
  });

  it("leaves out an item with no stock figure", () => {
    expect(new ShortageCalculator(stock).of([line("I-9999", "1")])).toEqual([]);
  });
});
