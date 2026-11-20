import {
  ORDER_MAX_LINES,
  ORDER_PERCENT_PATTERN,
  ORDER_PRICE_PATTERN,
  ORDER_QUANTITY_PATTERN,
  shipmentIsBeforeOrder,
} from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { z } from "zod";
import { requiredLookup } from "@/components/form";
import { lastPriceSchema } from "@/components/lines-grid";

/** What the API holds a PO number to: the form says so before the API does. */
export const PO_MAX_LENGTH = 35;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The order form's schema, on the patterns the server checks with, so a value
 * that passes here is not refused there for its shape. A role that cannot see
 * prices holds none: the server keeps the stored price of an unchanged line and refuses any other.
 */
export function makeOrderFormSchema(
  t: TFunction<"orders">,
  priceMasked: boolean,
) {
  const line = z.object({
    lineId: z.string(),
    item: requiredLookup(t("form.errors.item")),
    description: z.string().max(100, t("form.errors.description")),
    quantity: z
      .string()
      .regex(ORDER_QUANTITY_PATTERN, t("form.errors.quantity")),
    unitPrice: priceMasked
      ? z.string()
      : z.string().regex(ORDER_PRICE_PATTERN, t("form.errors.unitPrice")),
    unit: z.string(),
    availableStock: z.string().nullable(),
    // What the customer last paid, shown beside the price as context. Never sent.
    lastPrice: z
      .union([lastPriceSchema, z.literal("none"), z.literal("unknown")])
      .nullable()
      .optional(),
  });
  const fields = z.object({
    // The number of saves this form was typed against. It is a form value, so
    // a restored draft sends its own version and a stale one is refused.
    version: z.number().int().nullable(),
    customer: requiredLookup(t("form.errors.customer")),
    externalDocumentNo: z
      .string()
      .trim()
      .min(1, t("form.errors.po"))
      .max(PO_MAX_LENGTH, {
        error: (issue) =>
          t("form.errors.poLong", {
            max: PO_MAX_LENGTH,
            length: typeof issue.input === "string" ? issue.input.length : 0,
          }),
      }),
    orderDate: z.iso.date(t("form.errors.orderDate")),
    shipmentDate: z.union([
      z.literal(""),
      z.iso.date(t("form.errors.shipmentDate")),
    ]),
    prepaymentPercent: z
      .string()
      .regex(ORDER_PERCENT_PATTERN, t("form.errors.prepayment"))
      .refine((value) => Number(value) <= 100, t("form.errors.prepayment")),
    currency: z.string(),
    lines: z
      .array(line)
      .min(1, t("form.errors.none"))
      .max(ORDER_MAX_LINES, t("form.errors.tooMany")),
  });
  // The rule of the two dates is the one the API applies, and it sits on a
  // small object of its own so that it runs whatever the other fields hold.
  const dates = z
    .object({ orderDate: z.string(), shipmentDate: z.string() })
    .refine(
      (order) =>
        !(
          DAY.test(order.orderDate) &&
          DAY.test(order.shipmentDate) &&
          shipmentIsBeforeOrder(order.orderDate, order.shipmentDate)
        ),
      { path: ["shipmentDate"], message: t("form.errors.shipmentBeforeOrder") },
    );
  return fields.and(dates);
}

export type OrderFormSchema = ReturnType<typeof makeOrderFormSchema>;
export type OrderFormInput = z.input<OrderFormSchema>;
export type OrderFormOutput = z.output<OrderFormSchema>;
