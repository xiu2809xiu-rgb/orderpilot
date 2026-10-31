import { z } from "zod";
import { paymentTypeSchema } from "../governance/payment.js";
import { decimalStringSchema } from "../money.js";

// The payment types are F-1's (area 4 owns the policy that reads them), so
// they are imported here, never defined a second time.

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

export const paymentRecordSchema = paymentConfirmationInputSchema.extend({
  id: z.uuid(),
  orderNo: z.string().min(1),
  confirmedAt: z.iso.datetime(),
  confirmedBy: z.string().min(1),
});
export type PaymentRecord = z.infer<typeof paymentRecordSchema>;
