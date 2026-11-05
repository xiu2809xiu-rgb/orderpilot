import { z } from "zod";
import { pageEnvelope, pageQuerySchema } from "./envelope.js";
import type { Permission } from "./permissions.js";
import { roleSchema } from "./roles.js";

/**
 * Who may read a record's operation log: whoever may read the record. Each
 * kind of record, named as the audit writer names it (`entityType`), maps to
 * the permission that reads that record. A kind not listed has no operation
 * log, and a request for one is refused. The web app reads the same table, so
 * it never asks for a log the server would refuse. Area 4 owns the rule
 * (ADR 0042); a story that gives a new kind of record a log adds its line.
 */
export const OPERATION_LOG_READERS = {
  User: "users.read",
  Role: "roles.read",
  Order: "orders.read",
  Exception: "exceptions.read",
  Spr: "spr.read",
  WorkflowTask: "workflows.read",
} as const satisfies Record<string, Permission>;

export type OperationLogEntity = keyof typeof OPERATION_LOG_READERS;

export const OPERATION_LOG_ENTITIES = Object.keys(OPERATION_LOG_READERS) as [
  OperationLogEntity,
  ...OperationLogEntity[],
];

export const operationLogEntitySchema = z.enum(OPERATION_LOG_ENTITIES);

/** The permission that reads this kind of record's log, or undefined for a kind with none. */
export function operationLogReader(
  entityType: string | undefined,
): Permission | undefined {
  if (entityType === undefined) return undefined;
  return Object.hasOwn(OPERATION_LOG_READERS, entityType)
    ? OPERATION_LOG_READERS[entityType as OperationLogEntity]
    : undefined;
}

/** The record whose log is read: its kind and its id, as the audit writer stored them. */
export const operationLogParamsSchema = z.object({
  entityType: operationLogEntitySchema,
  entityId: z.string().trim().min(1).max(200),
});
export type OperationLogParams = z.infer<typeof operationLogParamsSchema>;

/** A page of the log, newest first. */
export const operationLogQuerySchema = pageQuerySchema;
export type OperationLogQuery = z.infer<typeof operationLogQuerySchema>;

/**
 * One line of a record's operation log: who, when and what. Never a field
 * value, an IP address, a trace id or a hash: those stay in the audit trail,
 * for the roles that may read it. "What" is the sentence the audit writer
 * composed, which holds no value a masking rule would hide (ADR 0027, point 6).
 */
export const operationLogEntrySchema = z.object({
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  actorKind: z.enum(["user", "system", "ai"]),
  /** The person's name, or the system part or model that acted. */
  actorName: z.string(),
  /** The person's role, or null for the system or a model. */
  actorRole: roleSchema.nullable(),
  summary: z.string(),
});
export type OperationLogEntry = z.infer<typeof operationLogEntrySchema>;

export const operationLogResponseSchema = pageEnvelope(operationLogEntrySchema);
