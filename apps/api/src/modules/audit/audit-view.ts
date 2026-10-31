import {
  isRefusalAction,
  type AuditEvent,
  type AuditEventView,
  type MaskingRule,
  type Role,
} from "@orderpilot/shared";
import { maskChanges } from "./domain/audit-masking.js";

/** The name to show for whoever acted: the person, the system part or the model. */
export function actorNameOf(
  actor: AuditEvent["actor"],
  names: ReadonlyMap<string, string>,
): string {
  switch (actor.kind) {
    case "user":
      return names.get(actor.userId) ?? "Unknown user";
    case "ai":
      return actor.model;
    default:
      return actor.name;
  }
}

/** One event as the viewer receives it, with its changes masked for `role`. */
export function toEventView(
  record: { sequence: number; event: AuditEvent },
  role: Role,
  rules: readonly MaskingRule[],
  names: ReadonlyMap<string, string>,
): AuditEventView {
  const { event } = record;
  return {
    sequence: record.sequence,
    id: event.id,
    occurredAt: event.occurredAt,
    actorKind: event.actor.kind,
    actorUserId: event.actor.kind === "user" ? event.actor.userId : null,
    actorRole: event.actor.kind === "user" ? event.actor.role : null,
    actorName: actorNameOf(event.actor, names),
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    summary: event.summary,
    changes: maskChanges(rules, role, event.entityType, event.changes),
    ip: event.ip,
    traceId: event.traceId,
    prevHash: event.prevHash,
    hash: event.hash,
    refusal: isRefusalAction(event.action),
  };
}
