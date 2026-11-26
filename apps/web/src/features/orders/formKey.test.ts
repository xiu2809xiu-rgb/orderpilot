import { describe, expect, it } from "vitest";
import { emptyLine } from "@/components/lines-grid";
import { formKey } from "./formKey";
import type { OrderFormInput } from "./orderFormSchema";
import { blankOrder } from "./orderFormValues";

const typed = (): OrderFormInput => ({
  ...blankOrder("2026-11-09"),
  customer: { number: "C-0001", name: "Quillon Harbour Traders" },
  externalDocumentNo: "PO-7731",
  lines: [
    {
      ...emptyLine(),
      item: { number: "I-0001", name: "Norvale Wireless Mouse" },
      quantity: "2",
      unitPrice: "18.40",
    },
  ],
});

describe("the key of the form", () => {
  it("is the same for the same typed values", () => {
    expect(formKey(typed())).toBe(formKey(typed()));
  });

  it.each([
    [
      "the customer",
      (v: OrderFormInput) => ({
        ...v,
        customer: { number: "C-0002", name: "x" },
      }),
    ],
    [
      "the PO number",
      (v: OrderFormInput) => ({ ...v, externalDocumentNo: "PO-7732" }),
    ],
    [
      "the order date",
      (v: OrderFormInput) => ({ ...v, orderDate: "2026-11-10" }),
    ],
    [
      "the shipment date",
      (v: OrderFormInput) => ({ ...v, shipmentDate: "2026-12-01" }),
    ],
    [
      "the prepayment",
      (v: OrderFormInput) => ({ ...v, prepaymentPercent: "30.00" }),
    ],
    [
      "a quantity",
      (v: OrderFormInput) => ({
        ...v,
        lines: v.lines.map((line) => ({ ...line, quantity: "3" })),
      }),
    ],
    [
      "a price",
      (v: OrderFormInput) => ({
        ...v,
        lines: v.lines.map((line) => ({ ...line, unitPrice: "19.00" })),
      }),
    ],
  ])("changes with %s", (_name, change) => {
    expect(formKey(change(typed()))).not.toBe(formKey(typed()));
  });

  it("ignores what a poll writes beside a line, and the empty line at the end", () => {
    const base = typed();
    const polled: OrderFormInput = {
      ...base,
      lines: [
        ...base.lines.map((line) => ({
          ...line,
          unit: "PCS",
          availableStock: "40.000",
          lastPrice: "none" as const,
        })),
        emptyLine(),
      ],
    };
    expect(formKey(polled)).toBe(formKey(base));
  });
});
