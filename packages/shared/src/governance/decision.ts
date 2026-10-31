import { z } from "zod";
import { decimalStringSchema } from "../money.js";
import { roleSchema } from "../roles.js";

/**
 * One shape for every policy decision: allowed or refused, the rule that
 * decided, and a reason a person can read. Area 4's policy returns it; areas 1
 * to 3 only read it. A refusal that reaches a caller is the standard error
 * envelope (code FORBIDDEN, a generic message, the trace id), never this
 * object: the reason goes to the audit trail, so a caller learns nothing about
 * the rules by probing.
 */
export const policyDecisionSchema = z.object({
  outcome: z.enum(["allowed", "refused"]),
  /** The rule that decided, such as "permission" or "no-self-approval". */
  rule: z.string().min(1),
  reason: z.string().min(1),
});
export type PolicyDecision = z.infer<typeof policyDecisionSchema>;

/**
 * What an area asks the policy before it acts: who, what, on which record,
 * and the facts the rules may need. The real rules that read it (limits,
 * segregation of duties, the bank-detail hold) are area 4's.
 */
export const policyRequestSchema = z.object({
  actor: z.object({ userId: z.uuid(), role: roleSchema }),
  /** `area.verb`, such as "order.approve" or "payment.confirm". */
  action: z.string().min(1),
  resource: z.object({ type: z.string().min(1), id: z.string().min(1) }),
  /** The amount at stake, for approval limits. */
  amount: decimalStringSchema.optional(),
  /** Who raised the request, for no self-approval. */
  requesterUserId: z.uuid().optional(),
});
export type PolicyRequest = z.infer<typeof policyRequestSchema>;
