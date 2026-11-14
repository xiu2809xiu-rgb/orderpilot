import type { OrderFlowDocument } from "@orderpilot/shared";
import { FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState, StatusBadge } from "@/components/common";
import { useTrackerTimeline } from "@/lib/api/generated/endpoints/tracker/tracker";
import { useWorkflowsOrderFlow } from "@/lib/api/generated/endpoints/workflows/workflows";
import { CheckResults } from "@/features/order-tracker/CheckResults";
import { formatDate, formatDay } from "@/features/workflows/format";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { Timeline } from "@/features/workflows/Timeline";
import { ApiError } from "@/lib/api/errors";

/** A sample order the workflow or the tracker does not know yet answers 404: that is an empty tab, not an error. */
function unknown(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/** What happened to the order, from the workflow's timeline. */
export function OrderTimelineTab({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation("orders");
  const query = useWorkflowsOrderFlow(orderNo);
  if (unknown(query.error)) return <EmptyState title={t("form.tabsEmpty")} />;
  return (
    <QueryBoundary query={query}>
      <Timeline events={query.data?.data.timeline ?? []} />
    </QueryBoundary>
  );
}

/** The cross-document checks on the order, from the tracker. */
export function OrderChecksTab({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation("orders");
  const query = useTrackerTimeline(orderNo);
  if (unknown(query.error)) return <EmptyState title={t("form.tabsEmpty")} />;
  return (
    <QueryBoundary query={query}>
      <CheckResults checks={query.data?.data.checks ?? []} />
    </QueryBoundary>
  );
}

const STATUS_TONE = {
  confirmed: "success",
  "to-confirm": "warning",
  expected: "neutral",
} as const;

function DocumentRow({ document }: { document: OrderFlowDocument }) {
  const { t } = useTranslation("orders");
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <span className="flex min-w-0 items-center gap-2">
        <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="font-medium">
          {t(`documents.types.${document.type}`)}
        </span>
        {document.number ? (
          <span
            data-numeric
            className="font-mono text-sm text-muted-foreground"
          >
            {document.number}
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {document.receivedAt
          ? t("documents.received", { date: formatDate(document.receivedAt) })
          : document.dueDate
            ? t("documents.due", { date: formatDay(document.dueDate) })
            : null}
        <StatusBadge tone={STATUS_TONE[document.status]}>
          {t(`documents.status.${document.status}`)}
        </StatusBadge>
      </span>
    </li>
  );
}

/** The order's documents, received and still expected, from the workflow. */
export function OrderDocumentsTab({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation("orders");
  const query = useWorkflowsOrderFlow(orderNo);
  if (unknown(query.error)) return <EmptyState title={t("form.tabsEmpty")} />;
  const documents = query.data?.data.documents ?? [];
  return (
    <QueryBoundary query={query}>
      {documents.length === 0 ? (
        <EmptyState title={t("form.tabsEmpty")} />
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((document) => (
            <DocumentRow key={document.id} document={document} />
          ))}
        </ul>
      )}
    </QueryBoundary>
  );
}
