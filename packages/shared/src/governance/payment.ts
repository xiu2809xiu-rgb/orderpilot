import { z } from "zod";
import { decimalStringSchema } from "../money.js";

/**
 * The business type of a payment. Payment confirmation records it, and the
 * policy reads it: a prepayment drives the payment gate (pay before ship).
 */
export const PAYMENT_TYPES = [
  "prepayment",
  "deposit",
  "balance",
  "full-payment",
] as const;
export const paymentTypeSchema = z.enum(PAYMENT_TYPES);
export type PaymentType = z.infer<typeof paymentTypeSchema>;

/**
 * What payment confirmation records, for the policy to use. Area 2 owns the
 * payment step and its table; this is the contract between the two areas.
 */
export const paymentConfirmationSchema = z.object({
  /** The record the payment is for, such as the sales order number. */
  orderNo: z.string().min(1),
  paymentType: paymentTypeSchema,
  amount: decimalStringSchema,
  confirmedByUserId: z.uuid(),
  confirmedAt: z.iso.datetime(),
});
export type PaymentConfirmation = z.infer<typeof paymentConfirmationSchema>;
