import type { AuditEvent, OperationLogEntry } from "@orderpilot/shared";
import { actorNameOf } from "../../audit/audit-view.js";

/**
 * One audit event as a line of a record's operation log: who, when and what.
 * It is built field by field, so nothing else the event holds (its changes,
 * the IP address, the trace id, the hashes) can reach the response, whatever
 * the event gains later. "Who" is named as the audit viewer names it.
 */
export function toOperationLogEntry(
  event: AuditEvent,
  names: ReadonlyMap<string, string>,
): OperationLogEntry {
  return {
    id: event.id,
    occurredAt: event.occurredAt,
    actorKind: event.actor.kind,
    actorName: actorNameOf(event.actor, names),
    actorRole: event.actor.kind === "user" ? event.actor.role : null,
    summary: event.summary,
  };
}

/** The people who acted in these events, so their names are read in one query. */
export function actorUserIds(events: readonly AuditEvent[]): string[] {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.actor.kind === "user") ids.add(event.actor.userId);
  }
  return [...ids];
}
