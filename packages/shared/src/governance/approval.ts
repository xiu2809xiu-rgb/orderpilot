import { z } from "zod";
import { decimalStringSchema } from "../money.js";

/**
 * Approval limits and a substitute, in the shape of Business Central's Approval User
 * Setup (User ID, Approver ID, Sales and Purchase Amount Approval Limits,
 * Unlimited flags, Substitute), so a later Business Central link maps one to one.
 * Area 4 keeps it in ApprovalUserSetup, with the absence Business Central does not
 * record, and its approval-route and approval-limit rules read it (F-3, ADR
 * 0041). Area 2 routes each SPR by it (C-3).
 */
export const approvalUserSetupSchema = z.object({
  userId: z.uuid(),
  /** Who approves what this user raises. */
  approverId: z.uuid().nullable(),
  salesAmountApprovalLimit: decimalStringSchema,
  purchaseAmountApprovalLimit: decimalStringSchema,
  unlimitedSalesApproval: z.boolean(),
  unlimitedPurchaseApproval: z.boolean(),
  /**
   * Acts for the approver while they are away or disabled, within the
   * substitute's own limits, not the approver's (ADR 0041).
   */
  substituteUserId: z.uuid().nullable(),
});
export type ApprovalUserSetup = z.infer<typeof approvalUserSetupSchema>;
