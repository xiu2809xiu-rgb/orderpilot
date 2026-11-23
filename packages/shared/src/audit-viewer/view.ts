import { z } from "zod";
import { dataEnvelope, pageEnvelope } from "../envelope.js";
import {
  classificationSchema,
  maskReasonSchema,
} from "../governance/classification.js";
import { storedRoleSchema } from "../roles.js";

/**
 * One entry of an event's `changes`, after masking. A masked entry has no
 * values: they stay on the server. `change` is true for a before and after
 * pair, false for a plain value (held in `after`).
 */
export const auditChangeSchema = z.object({
  field: z.string().min(1),
  classification: classificationSchema,
  masked: z.boolean(),
  reason: maskReasonSchema.nullable(),
  change: z.boolean(),
  before: z.string().nullable(),
  after: z.string().nullable(),
});
export type AuditChange = z.infer<typeof auditChangeSchema>;

/** An audit event as the viewer receives it. */
export const auditEventViewSchema = z.object({
  /** The chain's order. */
  sequence: z.int().min(1),
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  actorKind: z.enum(["user", "system", "ai"]),
  actorUserId: z.uuid().nullable(),
  // A stored role: an old event can name a retired one (ADR 0058).
  actorRole: storedRoleSchema.nullable(),
  /** The person's name, or the system or model that acted. */
  actorName: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  summary: z.string(),
  changes: z.array(auditChangeSchema),
  ip: z.string().nullable(),
  traceId: z.string(),
  prevHash: z.string().nullable(),
  hash: z.string(),
  refusal: z.boolean(),
});
export type AuditEventView = z.infer<typeof auditEventViewSchema>;

export const auditEventListResponseSchema = pageEnvelope(auditEventViewSchema);
export const auditEventResponseSchema = dataEnvelope(auditEventViewSchema);

/**
 * The result of walking the whole chain. `verifiedThrough` is the last
 * sequence that fits. When the chain is broken, `brokenAtSequence` is the
 * first event that does not.
 */
export const auditChainCheckSchema = z.object({
  ok: z.boolean(),
  checked: z.int().min(0),
  verifiedThrough: z.int().min(0).nullable(),
  brokenAtSequence: z.int().min(1).nullable(),
  brokenAtEventId: z.uuid().nullable(),
  problem: z.enum(["prevHash-mismatch", "hash-mismatch"]).nullable(),
  checkedAt: z.iso.datetime(),
});
export type AuditChainCheck = z.infer<typeof auditChainCheckSchema>;
export const auditChainCheckResponseSchema = dataEnvelope(
  auditChainCheckSchema,
);

/** The path of the one-event route. */
export const auditEventParamsSchema = z.object({ id: z.uuid() });

/**
 * What the audit filters offer (F-9): each person who appears in the trail,
 * by the id the filter sends and the name it shows, and each action name that
 * exists. Strict, so an email or any other detail of a person cannot ride
 * along.
 */
export const auditFilterOptionsSchema = z.strictObject({
  people: z.array(z.strictObject({ id: z.uuid(), name: z.string().min(1) })),
  actions: z.array(z.string().min(1)),
});
export type AuditFilterOptions = z.infer<typeof auditFilterOptionsSchema>;
export const auditFilterOptionsResponseSchema = dataEnvelope(
  auditFilterOptionsSchema,
);
