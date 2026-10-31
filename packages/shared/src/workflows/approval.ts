import { z } from "zod";
import { decimalStringSchema } from "../money.js";

/**
 * Navision's Approval User Setup, field for field in camelCase, so that a later
 * Navision link maps one row to one row. Area 4 owns the policy that fills and
 * judges these; area 2 only calls it (see `ApprovalPolicy` in the API).
 */
export const approvalUserSetupSchema = z.object({
  /** Navision "User ID": the person this row is about. */
  userId: z.string().min(1),
  /** Navision "Approver ID": who approves this person's requests. */
  approverId: z.string().min(1).nullable(),
  salesAmountApprovalLimit: decimalStringSchema.nullable(),
  purchaseAmountApprovalLimit: decimalStringSchema.nullable(),
  unlimitedSalesApproval: z.boolean(),
  unlimitedPurchaseApproval: z.boolean(),
  /** Navision "Substitute": who approves while this person is away. */
  substitute: z.string().min(1).nullable(),
});
export type ApprovalUserSetup = z.infer<typeof approvalUserSetupSchema>;
