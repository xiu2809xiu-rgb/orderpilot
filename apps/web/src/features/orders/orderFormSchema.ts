import {
  ORDER_MAX_LINES,
  ORDER_PERCENT_PATTERN,
  ORDER_PRICE_PATTERN,
  ORDER_QUANTITY_PATTERN,
} from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { z } from "zod";
import { requiredLookup } from "@/components/form";

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
    // The item's list price, shown beside the price as context. Never sent.
    listPrice: z.string().nullable().optional(),
  });
  return z.object({
    // The number of saves this form was typed against. It is a form value, so
    // a restored draft sends its own version and a stale one is refused.
    version: z.number().int().nullable(),
    customer: requiredLookup(t("form.errors.customer")),
    externalDocumentNo: z
      .string()
      .trim()
      .min(1, t("form.errors.po"))
      .max(35, t("form.errors.poLong")),
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
}

export type OrderFormSchema = ReturnType<typeof makeOrderFormSchema>;
export type OrderFormInput = z.input<OrderFormSchema>;
export type OrderFormOutput = z.output<OrderFormSchema>;
