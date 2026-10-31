import {
  AuditLink,
  ErrorPanel,
  OperationLog,
  type OperationLogRow,
} from "@/components/common";
import { useAuditViewerList } from "@/lib/api/generated/endpoints/audit/audit";
import type { AuditViewerList200DataItem } from "@/lib/api/generated/model";
import { hasPermission, useSessionStore } from "@/stores/session";

/**
 * An audit event as a row of P-12's OperationLog. "What changed" is the
 * event's summary, a sentence the writer composed. The values in `changes` are
 * masked on the server and stay on the audit page.
 */
export function toOperationRows(
  events: readonly AuditViewerList200DataItem[],
): OperationLogRow[] {
  return events.map((event) => ({
    id: event.id,
    at: event.occurredAt,
    user: event.actorName,
    ip: event.ip ?? "-",
    change: event.summary,
  }));
}

interface EntityOperationLogProps {
  /** The kind of record, as the audit writer names it: "User", "Order". */
  entityType: string;
  /** The record's id, as the audit writer stored it. */
  entityId: string;
  /** A name for screen readers on the audit link, such as "user Azri". */
  subject?: string;
  /** How many of the newest events to show. The audit link opens the rest. */
  limit?: number;
}

/**
 * The operation log under a record, fed from the audit trail. Drop it at the
 * foot of a detail page:
 *
 *   <EntityOperationLog entityType="Order" entityId={order.id} />
 *
 * It shows nothing to a role without `audit.read`, so a page can always
 * include it. The record's events must be written with the same entity type
 * and id (`AuditService.record`), which is what the filter matches.
 */
export function EntityOperationLog({
  entityType,
  entityId,
  subject,
  limit = 10,
}: EntityOperationLogProps) {
  const allowed = useSessionStore((state) =>
    hasPermission(state.session, "audit.read"),
  );
  const events = useAuditViewerList(
    { entityType, entityId, pageSize: limit },
    { query: { enabled: allowed } },
  );
  if (!allowed) return null;
  if (events.isError) {
    return (
      <ErrorPanel error={events.error} onRetry={() => void events.refetch()} />
    );
  }
  return (
    <OperationLog
      rows={toOperationRows(events.data?.data ?? [])}
      loading={events.isPending}
      demo
      action={<AuditLink entity={entityType} id={entityId} subject={subject} />}
    />
  );
}
