import { z } from "zod";
import { decimalStringSchema } from "./money.js";
import { roleSchema } from "./roles.js";

export const auditActorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: z.uuid(), role: roleSchema }),
  z.object({ kind: z.literal("system"), name: z.string().min(1) }),
  z.object({ kind: z.literal("ai"), model: z.string().min(1) }),
]);
export type AuditActor = z.infer<typeof auditActorSchema>;

/** One append-only audit event. Each hash covers the one before it, so a gap shows. */
export const auditEventSchema = z.object({
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  actor: auditActorSchema,
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  summary: z.string(),
  // What changed. Never a secret, a token or a full document.
  changes: z.record(z.string(), z.unknown()).nullable(),
  ip: z.string().nullable(),
  traceId: z.string().min(1),
  prevHash: z.string().nullable(),
  hash: z.string().min(1),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

export const AI_USAGE_STATUSES = ["ok", "error", "refused", "timeout"] as const;

/** One model call: what was asked for, what it cost, how long it took. */
export const aiUsageSchema = z.object({
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  feature: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  promptVersion: z.string().min(1),
  inputTokens: z.int().min(0),
  outputTokens: z.int().min(0),
  costUsd: decimalStringSchema,
  latencyMs: z.int().min(0),
  status: z.enum(AI_USAGE_STATUSES),
  userId: z.uuid().nullable(),
  traceId: z.string().min(1),
});
export type AiUsage = z.infer<typeof aiUsageSchema>;
