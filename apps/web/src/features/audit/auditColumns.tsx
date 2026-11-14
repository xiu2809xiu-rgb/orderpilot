import type { AuditViewerList200DataItem } from "@/lib/api/generated/model";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CopyButton,
  RelativeTime,
  StatusBadge,
  type DataTableColumn,
} from "@/components/common";
import { Button } from "@/components/ui/button";

export type AuditRow = AuditViewerList200DataItem;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A UUID is unreadable in a list, so it shows its first characters; the whole
 * is in the title, the copy button and the event's details. Anything else,
 * such as a route, shows whole. (From Azri's #270.)
 */
export function shortId(id: string): string {
  return UUID.test(id) ? `${id.slice(0, 8)}\u2026` : id;
}

/**
 * The columns of the audit table. No column sorts: the trail is always newest
 * first. The long cells wrap inside themselves, and the role and the refused
 * badge sit under the name and the action, so the table fits its card at 1440
 * px and Details stays in view without scrolling sideways.
 */
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
          <span className="flex flex-col">
            <span>{row.actorName}</span>
            {row.actorRole ? (
              <span className="text-xs text-muted-foreground">
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
          <span className="flex flex-col items-start gap-1">
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
          <span
            className="flex max-w-56 flex-wrap items-center gap-x-1 text-sm whitespace-normal"
            title={`${row.entityType} ${row.entityId}`}
          >
            {row.entityType}{" "}
            <span className="font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {shortId(row.entityId)}
            </span>
            <CopyButton
              value={row.entityId}
              what={t("table.recordIdOf", { sequence: row.sequence })}
            />
          </span>
        ),
      },
      {
        id: "summary",
        header: t("table.summary"),
        cell: (row) => (
          <span className="block min-w-48 whitespace-normal">
            {row.summary}
          </span>
        ),
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
