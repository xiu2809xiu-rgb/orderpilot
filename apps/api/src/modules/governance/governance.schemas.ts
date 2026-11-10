import {
  aiDestinationDecisionSchema,
  aiDestinationRuleSchema,
  dataEnvelope,
  maskedFieldSchema,
  maskingRuleSchema,
  matrixMetaSchema,
  matrixSchema,
  pageEnvelope,
  pageQuerySchema,
  roleAccessSchema,
} from "@orderpilot/shared";
import { z } from "zod";
import { BANK_DETAIL_SOURCES } from "./domain/bank-comparison.js";
import { BANK_FIELDS, containsAccountNumber } from "./domain/bank-details.js";

export const matrixResponseSchema = dataEnvelope(matrixSchema).extend({
  meta: matrixMetaSchema,
});
export const roleAccessResponseSchema = dataEnvelope(roleAccessSchema);

/** One synthetic customer with the sample rule applied for the caller's role. */
export const maskingSampleRecordSchema = z.object({
  customerNo: z.string(),
  customerName: z.string(),
  note: maskedFieldSchema,
});
export type MaskingSampleRecord = z.infer<typeof maskingSampleRecordSchema>;

export const maskingSampleResponseSchema = z.object({
  data: z.object({
    rules: z.array(maskingRuleSchema),
    records: z.array(maskingSampleRecordSchema),
  }),
  // The records are synthetic. The page says so with the Mock badge.
  meta: z.object({ mock: z.literal(true) }),
});

export const aiRulesResponseSchema = dataEnvelope(
  z.array(aiDestinationRuleSchema),
);
export const aiDecisionResponseSchema = dataEnvelope(
  aiDestinationDecisionSchema,
);

const bankHoldStatusSchema = z.enum(["open", "cleared"]);
const holdResolutionSchema = z.enum([
  "accept-new-details",
  "keep-stored-details",
]);
const verificationOutcomeSchema = z.enum(["confirmed", "rejected"]);

/** Free text about a hold is stored and shown, so a pasted number must not get in. */
const holdReasonSchema = z
  .string()
  .trim()
  .min(3)
  .max(500)
  .refine((text) => !containsAccountNumber(text), {
    message: "Leave account numbers out of this text.",
  });

export const bankHoldParamsSchema = z.object({ id: z.uuid() });
export type BankHoldParams = z.infer<typeof bankHoldParamsSchema>;

export const bankHoldQuerySchema = pageQuerySchema.extend({
  status: bankHoldStatusSchema.optional(),
  vendorNo: z.string().trim().min(1).max(50).optional(),
});
export type BankHoldQueryParams = z.infer<typeof bankHoldQuerySchema>;

/** Who verified comes from the session, never from here. */
export const recordVerificationBodySchema = z.strictObject({
  outcome: verificationOutcomeSchema,
  contactedAt: z.iso.datetime(),
  /** That the contact came from the stored record, not the new document. */
  contactFromStoredRecord: z.boolean(),
  reason: holdReasonSchema,
});
export type RecordVerificationBody = z.infer<
  typeof recordVerificationBodySchema
>;

export const clearBankHoldBodySchema = z.strictObject({
  resolution: holdResolutionSchema,
  reason: holdReasonSchema,
});
export type ClearBankHoldBody = z.infer<typeof clearBankHoldBodySchema>;

export const bankHoldSchema = z.object({
  id: z.uuid(),
  vendorNo: z.string(),
  accountCode: z.string().nullable(),
  status: bankHoldStatusSchema,
  source: z.enum(BANK_DETAIL_SOURCES),
  sourceRef: z.string(),
  changedByUserId: z.uuid().nullable(),
  differingFields: z.array(z.enum(BANK_FIELDS)),
  fields: z.array(
    z.object({
      field: z.enum(BANK_FIELDS),
      differs: z.boolean(),
      before: maskedFieldSchema,
      after: maskedFieldSchema,
    }),
  ),
  verifications: z.array(
    z.object({
      id: z.uuid(),
      verifiedByUserId: z.uuid(),
      outcome: verificationOutcomeSchema,
      contactedAt: z.iso.datetime(),
      contactFromStoredRecord: z.boolean(),
      recordedAt: z.iso.datetime(),
      note: maskedFieldSchema,
    }),
  ),
  /** Why the hold cannot move, such as "needs a different Finance user". */
  blockedReason: z.string().nullable(),
  openedAt: z.iso.datetime(),
  resolution: holdResolutionSchema.nullable(),
  clearedAt: z.iso.datetime().nullable(),
  clearedByUserId: z.uuid().nullable(),
  clearReason: maskedFieldSchema.nullable(),
});
export type BankHoldView = z.infer<typeof bankHoldSchema>;

export const bankHoldResponseSchema = dataEnvelope(bankHoldSchema);
export const bankHoldListResponseSchema = pageEnvelope(bankHoldSchema);
