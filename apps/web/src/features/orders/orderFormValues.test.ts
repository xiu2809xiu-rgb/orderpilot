import { describe, expect, it } from "vitest";
import { must } from "@/test/must";
import { draftDetail, maskedPrice } from "./orderTestKit";
import {
  blankOrder,
  fromDetail,
  toCreateBody,
  toPatchBody,
  withoutBlankTail,
} from "./orderFormValues";
import type { OrderFormOutput } from "./orderFormSchema";

function output(over: Partial<OrderFormOutput> = {}): OrderFormOutput {
  const [line] = fromDetail(draftDetail()).lines;
  return {
    version: 3,
    customer: { number: "C-0001", name: "Quillon Harbour Traders" },
    externalDocumentNo: "PO-7731",
    orderDate: "2026-11-09",
    shipmentDate: "",
    prepaymentPercent: "100.00",
    currency: "USD",
    lines: [
      {
        lineId: line?.lineId ?? "",
        item: { number: "I-0001", name: "Norvale Wireless Mouse" },
        description: "Norvale Wireless Mouse",
        quantity: "2",
        unitPrice: "18.40",
        unit: "PCS",
        availableStock: "40.000",
      },
    ],
    ...over,
  };
}

describe("the order form's values", () => {
  it("starts blank with today's date, the whole prepayment and one empty line", () => {
    const blank = blankOrder("2026-11-09");
    expect(blank).toMatchObject({
      version: null,
      customer: null,
      orderDate: "2026-11-09",
      prepaymentPercent: "100.00",
      currency: "USD",
    });
    expect(blank.lines).toHaveLength(1);
  });

  it("reads a saved order: 2.000 is 2, the price keeps two decimals, the number is the customer", () => {
    const values = fromDetail(draftDetail());
    expect(values.customer).toEqual({
      number: "C-0001",
      name: "Quillon Harbour Traders",
    });
    expect(values.version).toBe(3);
    expect(values.lines[0]).toMatchObject({
      quantity: "2",
      unitPrice: "18.40",
      lineId: "SO-20261109-0001-1",
    });
  });

  it("keeps a decimal quantity and holds no price for a masked one", () => {
    const base = draftDetail();
    const detail = draftDetail({
      lines: base.lines.map((line) => ({
        ...line,
        quantity: "2.500",
        unitPrice: maskedPrice,
      })),
    });
    expect(fromDetail(detail).lines[0]).toMatchObject({
      quantity: "2.5",
      unitPrice: "",
    });
  });

  it("builds the create body from numbers, with no version and a null empty date", () => {
    expect(toCreateBody(output(), false)).toEqual({
      customerNo: "C-0001",
      externalDocumentNo: "PO-7731",
      orderDate: "2026-11-09",
      shipmentDate: null,
      prepaymentPercent: "100.00",
      lines: [
        {
          itemNo: "I-0001",
          description: "Norvale Wireless Mouse",
          quantity: "2",
          unitPrice: "18.40",
        },
      ],
    });
  });

  it("sends no price for a masked role, and no blank description", () => {
    const body = toCreateBody(
      output({
        lines: [
          { ...must(output().lines[0]), description: "  ", unitPrice: "" },
        ],
      }),
      true,
    );
    expect(body.lines[0]).toEqual({ itemNo: "I-0001", quantity: "2" });
  });

  it("builds the patch body with the version the form was typed against", () => {
    expect(toPatchBody(output({ version: 7 }), false).version).toBe(7);
  });
});

describe("the blank line at the end", () => {
  const typed = (over: object = {}) => ({
    ...must(fromDetail(draftDetail()).lines[0]),
    ...over,
  });
  const blank = () => ({ ...must(blankOrder("2026-11-09").lines[0]) });

  it("is left out, however many there are, when a typed line comes before", () => {
    const values = {
      ...blankOrder("2026-11-09"),
      lines: [typed(), blank(), blank()],
    };
    expect(withoutBlankTail(values).lines).toEqual([typed()]);
  });

  it("keeps a blank line between typed ones, and a line touched with only a quantity", () => {
    const touched = { ...blank(), quantity: "3" };
    const values = {
      ...blankOrder("2026-11-09"),
      lines: [typed(), blank(), touched],
    };
    expect(withoutBlankTail(values).lines).toHaveLength(3);
    const tail = { ...blankOrder("2026-11-09"), lines: [typed(), touched] };
    expect(withoutBlankTail(tail)).toBe(tail);
  });

  it("leaves a form nobody has typed in alone, so its errors say where to start", () => {
    const empty = blankOrder("2026-11-09");
    expect(withoutBlankTail(empty)).toBe(empty);
  });
});
