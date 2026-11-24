import { z } from "zod";
import { mockRecordedSchema, orderNoSchema } from "./common.js";

/** A sales approval, while SALES_APPROVAL asks for one (#251, point 9). */
export const salesApprovalInputSchema = z.object({
  comment: z.string().trim().min(1, "Say why").max(500),
});
export type SalesApprovalInput = z.infer<typeof salesApprovalInputSchema>;

export const salesApprovalResultSchema = mockRecordedSchema.extend({
  orderNo: orderNoSchema,
  /** True once approved; false once the approval is undone. */
  approved: z.boolean(),
});
export type SalesApprovalResult = z.infer<typeof salesApprovalResultSchema>;
