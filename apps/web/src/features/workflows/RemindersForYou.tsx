import type { WorkflowNotice } from "@orderpilot/shared";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RecordLink, SectionCard, StatusBadge } from "@/components/common";
import { useWorkflowsNoticesForMe } from "@/lib/api/generated/endpoints/workflows/workflows";
import { useOrderLinks } from "@/features/directions/screens/home/homeLinks";
import { formatDate, formatDateTime } from "./format";
import { QueryBoundary } from "./QueryBoundary";

/** The most the route gives. Nobody should have anything like this many open. */
const MAX_SHOWN = 200;

const TONES = { REMINDER: "info", ESCALATION: "danger" } as const;

function NoticeRow({ notice }: { notice: WorkflowNotice }) {
  const { t } = useTranslation("workflows");
  const links = useOrderLinks();
  return (
    <li className="flex flex-col gap-1 py-s2 sm:flex-row sm:items-center sm:gap-s3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">
          {t(`forYou.messages.${notice.kind}`, {
            task: t(`task.kinds.${notice.taskKind}`),
            order: notice.orderNo,
          })}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <RecordLink
            to={links.order(notice.orderNo)}
            className="inline-flex items-center font-mono text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
          >
            {notice.orderNo}
          </RecordLink>
          <span>
            {t("reminders.dueOn", { date: formatDate(notice.dueAt) })}
          </span>
          <span>
            {t("forYou.sentOn", { date: formatDateTime(notice.sentAt) })}
          </span>
        </p>
      </div>
      <span className="shrink-0">
        <StatusBadge tone={TONES[notice.kind]}>
          {t(`forYou.kinds.${notice.kind}`)}
        </StatusBadge>
      </span>
    </li>
  );
}

/**
 * Reminders and escalations that have really gone out to this person or their
 * role. It reaches a role with no list of its own, and appears only when there
 * is something to say. `folded` hides the rows behind one line, for a page
 * whose own list already shows what was sent.
 */
export function RemindersForYou({ folded = false }: { folded?: boolean }) {
  const { t } = useTranslation("workflows");
  const query = useWorkflowsNoticesForMe({ pageSize: MAX_SHOWN });
  const notices = query.data?.data ?? [];
  if (!query.isError && notices.length === 0) return null;

  const list = (
    <QueryBoundary query={query}>
      <ul className="divide-y divide-border">
        {notices.map((notice) => (
          <NoticeRow key={notice.id} notice={notice} />
        ))}
      </ul>
    </QueryBoundary>
  );

  return (
    <SectionCard
      title={t("forYou.title")}
      description={t("forYou.description")}
      work
    >
      {folded ? (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-md text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none"
            />
            {t("forYou.show", { count: query.data?.meta.total ?? 0 })}
          </summary>
          {list}
        </details>
      ) : (
        list
      )}
    </SectionCard>
  );
}
