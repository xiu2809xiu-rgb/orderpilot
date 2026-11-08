import { describe, expect, it } from "vitest";
import { ValidationFailedError } from "../../../common/domain-error.js";
import { draftLines, type DraftLineContext } from "./draft-lines.js";

const items = new Map([
  ["I-0001", { description: "Switch", unitPrice: "10.00" }],
  ["I-0002", { description: "Cable", unitPrice: "2.50" }],
]);

function context(over: Partial<DraftLineContext> = {}): DraftLineContext {
  return { items, canSeePrice: true, stored: [], ...over };
}

function issuesOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationFailedError) return error.details ?? [];
    throw error;
  }
  throw new Error("did not throw");
}

describe("draftLines", () => {
  it("numbers from 1, ships the whole quantity and fills a blank description", () => {
    const lines = draftLines(
      {
        lines: [
          { itemNo: "I-0001", quantity: "4", unitPrice: "9.00" },
          {
            itemNo: "I-0002",
            description: "Own words",
            quantity: "1.5",
            unitPrice: "2.50",
          },
        ],
      },
      context(),
    );
    expect(lines).toEqual([
      {
        lineNo: 1,
        itemNo: "I-0001",
        description: "Switch",
        quantity: "4",
        unitPrice: "9.00",
        qtyToShip: "4",
      },
      {
        lineNo: 2,
        itemNo: "I-0002",
        description: "Own words",
        quantity: "1.5",
        unitPrice: "2.50",
        qtyToShip: "1.5",
      },
    ]);
  });

  it("refuses an unknown item at the grid's zero-based index", () => {
    expect(
      issuesOf(() =>
        draftLines(
          {
            lines: [
              { itemNo: "I-0001", quantity: "1", unitPrice: "1" },
              { itemNo: "I-9999", quantity: "1", unitPrice: "1" },
            ],
          },
          context(),
        ),
      ),
    ).toEqual([
      { path: "lines.1.itemNo", message: expect.any(String) as string },
    ]);
  });

  it("refuses an amount too large to hold on the quantity", () => {
    expect(
      issuesOf(() =>
        draftLines(
          {
            lines: [
              {
                itemNo: "I-0001",
                quantity: "99999999999999",
                unitPrice: "99999999999999",
              },
            ],
          },
          context(),
        ),
      ).map((i) => i.path),
    ).toEqual(["lines.0.quantity"]);
  });

  it("needs a price from a role that sees prices", () => {
    expect(
      issuesOf(() =>
        draftLines({ lines: [{ itemNo: "I-0001", quantity: "1" }] }, context()),
      ).map((i) => i.path),
    ).toEqual(["lines.0.unitPrice"]);
  });

  describe("for a role that sees no prices", () => {
    const masked = { canSeePrice: false };

    it("refuses a price that was sent", () => {
      expect(
        issuesOf(() =>
          draftLines(
            { lines: [{ itemNo: "I-0001", quantity: "1", unitPrice: "1.00" }] },
            context(masked),
          ),
        ).map((i) => i.path),
      ).toEqual(["lines.0.unitPrice"]);
    });

    it("starts at the list price and keeps a stored price of the same item", () => {
      const lines = draftLines(
        {
          lines: [
            { itemNo: "I-0001", quantity: "1" },
            { itemNo: "I-0002", quantity: "2" },
          ],
        },
        context({
          ...masked,
          stored: [
            {
              lineNo: 1,
              itemNo: "I-0002",
              description: "Cable",
              quantity: "1",
              unitPrice: "1.75",
              qtyToShip: "1",
            },
          ],
        }),
      );
      expect(lines.map((l) => l.unitPrice)).toEqual(["10.00", "1.75"]);
    });
  });
});
