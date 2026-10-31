import { z } from "zod";
import { decimalStringSchema } from "../money.js";

/**
 * Approval limits and a substitute, in the shape of Navision's Approval User
 * Setup (User ID, Approver ID, Sales and Purchase Amount Approval Limits,
 * Unlimited flags, Substitute), so a later Navision link maps one to one.
 * A contract only: no table, no route and no rule reads it yet. Areas 2 and 4
 * build on it (F-3 for the limits).
 */
export const approvalUserSetupSchema = z.object({
  userId: z.uuid(),
  /** Who approves what this user raises. */
  approverId: z.uuid().nullable(),
  salesAmountApprovalLimit: decimalStringSchema,
  purchaseAmountApprovalLimit: decimalStringSchema,
  unlimitedSalesApproval: z.boolean(),
  unlimitedPurchaseApproval: z.boolean(),
  /** Acts for the approver while they are away, with the same limits. */
  substituteUserId: z.uuid().nullable(),
});
export type ApprovalUserSetup = z.infer<typeof approvalUserSetupSchema>;
