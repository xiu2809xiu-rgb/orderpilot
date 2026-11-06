import { operationLogReader, type OperationLogEntry } from "@orderpilot/shared";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ErrorPanel,
  OperationLog,
  PermissionDenied,
  SectionCard,
  type OperationLogRow,
} from "@/components/common";
import { useOperationLogList } from "@/lib/api/generated/endpoints/operation-log/operation-log";
import { isForbidden } from "@/lib/query-status";
import { hasPermission, useSessionStore } from "@/stores/session";
import type { OperationLogSpec } from "./types";

/** How many of the newest lines the panel shows. */
const NEWEST = 10;

/** "Mei Tan (Support)": who acted, with the role a person held then. */
function rowsOf(
  entries: readonly OperationLogEntry[],
  roleName: (role: NonNullable<OperationLogEntry["actorRole"]>) => string,
): OperationLogRow[] {
  return entries.map((entry) => ({
    id: entry.id,
    at: entry.occurredAt,
    user: entry.actorRole
      ? `${entry.actorName} (${roleName(entry.actorRole)})`
      : entry.actorName,
    change: entry.summary,
  }));
}

interface RecordLogPanelProps<Row> {
  spec: OperationLogSpec<Row>;
  /** The ticked rows: the log shows when exactly one is. */
  selected: readonly Row[];
  rowLabel: (row: Row) => string;
}

/**
 * The selected record's operation log, at the foot of the list: who did what
 * and when, never a value or an IP address. Nothing is drawn for a role that
 * may not read this kind of record, so it never asks for a refusal.
 */
export function RecordLogPanel<Row>({
  spec,
  selected,
  rowLabel,
}: RecordLogPanelProps<Row>) {
  const { t } = useTranslation("list-page");
  const allowed = useSessionStore((state) => {
    const reader = operationLogReader(spec.entityType);
    return reader !== undefined && hasPermission(state.session, reader);
  });
  if (!allowed) return null;
  const [one] = selected;
  if (selected.length !== 1 || one === undefined) {
    return (
      <SectionCard title={t("log.title")}>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <History className="size-4 shrink-0" aria-hidden="true" />
          {selected.length === 0
            ? t("log.pickOne")
            : t("log.tooMany", { count: selected.length })}
        </p>
      </SectionCard>
    );
  }
  return (
    <SelectedLog
      spec={spec}
      entityId={spec.entityId(one)}
      label={rowLabel(one)}
    />
  );
}

export function SelectedLog<Row>({
  spec,
  entityId,
  label,
}: {
  spec: OperationLogSpec<Row>;
  entityId: string;
  label: string;
}) {
  const { t } = useTranslation("list-page");
  const { t: tc } = useTranslation("common");
  const log = useOperationLogList(
    spec.entityType,
    encodeURIComponent(entityId),
    { pageSize: NEWEST },
  );
  const title = t("log.titleFor", { record: label });
  if (log.isError) {
    return (
      <SectionCard title={title}>
        {isForbidden(log.error) ? (
          <PermissionDenied />
        ) : (
          <ErrorPanel error={log.error} onRetry={() => void log.refetch()} />
        )}
      </SectionCard>
    );
  }
  const total = log.data?.meta.total ?? 0;
  return (
    <OperationLog
      title={title}
      rows={rowsOf(log.data?.data ?? [], (role) => tc(`roles.${role}`))}
      loading={log.isPending}
      showIp={false}
      footer={
        total > NEWEST ? (
          <p className="mt-s2 text-sm text-muted-foreground">
            {t("log.newest", { shown: NEWEST, total })}
          </p>
        ) : null
      }
    />
  );
}
