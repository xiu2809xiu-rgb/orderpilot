import { z } from "zod";
import { decimalStringSchema } from "../money.js";

/**
 * The business type of a payment. Prepayment is the one the payment gate will
 * watch (Azri builds the gate); the others are here so a confirmation never has
 * to guess. The list is data for the form and the table, and it may grow.
 */
export const PAYMENT_TYPES = [
  "PREPAYMENT",
  "BALANCE",
  "FULL_PAYMENT",
  "REFUND",
  "OTHER",
] as const;
export const paymentTypeSchema = z.enum(PAYMENT_TYPES);
export type PaymentType = z.infer<typeof paymentTypeSchema>;

/** What Finance enters when confirming that money arrived. */
export const paymentConfirmationInputSchema = z.object({
  paymentType: paymentTypeSchema,
  amount: decimalStringSchema.refine((value) => Number(value) > 0, {
    message: "The amount must be more than zero",
  }),
  currencyCode: z.string().length(3),
  /** The bank's reference for the transfer. */
  reference: z.string().trim().min(1).max(60),
  paidOn: z.iso.date(),
});
export type PaymentConfirmationInput = z.infer<
  typeof paymentConfirmationInputSchema
>;

export const paymentConfirmationSchema = paymentConfirmationInputSchema.extend({
  id: z.uuid(),
  orderNo: z.string().min(1),
  confirmedAt: z.iso.datetime(),
  confirmedBy: z.string().min(1),
});
export type PaymentConfirmation = z.infer<typeof paymentConfirmationSchema>;
