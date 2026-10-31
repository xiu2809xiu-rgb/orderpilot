import type { AuditViewerList200DataItem } from "@/lib/api/generated/model";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  RelativeTime,
  StatusBadge,
  type DataTableColumn,
} from "@/components/common";
import { Button } from "@/components/ui/button";

export type AuditRow = AuditViewerList200DataItem;

/** The columns of the audit table. No column sorts: the trail is always newest first. */
export function useAuditColumns(onOpen: (id: string) => void) {
  const { t } = useTranslation("audit");
  const { t: tc } = useTranslation();
  return useMemo<DataTableColumn<AuditRow>[]>(
    () => [
      {
        id: "sequence",
        header: t("table.sequence"),
        hideable: false,
        kind: "number",
        cell: (row) => <span data-numeric>{row.sequence}</span>,
        exportValue: (row) => row.sequence,
      },
      {
        id: "time",
        header: t("table.time"),
        cell: (row) => <RelativeTime value={row.occurredAt} />,
      },
      {
        id: "actor",
        header: t("table.actor"),
        cell: (row) => (
          <span>
            {row.actorName}
            {row.actorRole ? (
              <span className="ml-2 text-xs text-muted-foreground">
                {tc(`roles.${row.actorRole}`)}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "action",
        header: t("table.action"),
        cell: (row) => (
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="font-mono text-xs">{row.action}</code>
            {row.refusal ? (
              <StatusBadge tone="warning">{t("table.refused")}</StatusBadge>
            ) : null}
          </span>
        ),
      },
      {
        id: "record",
        header: t("table.record"),
        cell: (row) => (
          <span className="font-mono text-xs">
            {row.entityType} {row.entityId}
          </span>
        ),
      },
      {
        id: "summary",
        header: t("table.summary"),
        cell: (row) => row.summary,
      },
      {
        id: "ip",
        header: t("table.ip"),
        defaultHidden: true,
        cell: (row) => (
          <span className="font-mono text-xs">{row.ip ?? "-"}</span>
        ),
      },
      {
        id: "open",
        header: t("table.open"),
        hideable: false,
        cell: (row) => (
          <Button
            variant="outline"
            size="sm"
            aria-label={t("table.openFor", { sequence: row.sequence })}
            onClick={() => {
              onOpen(row.id);
            }}
          >
            {t("table.open")}
          </Button>
        ),
      },
    ],
    [t, tc, onOpen],
  );
}
