import { useTranslation } from "react-i18next";
import { RecordLink, SectionCard, StatusBadge } from "@/components/common";
import { useWorkflowsNoticesForMe } from "@/lib/api/generated/endpoints/workflows/workflows";
import { formatDate, formatDateTime } from "./format";
import { QueryBoundary } from "./QueryBoundary";

/** The most the route gives. Nobody should have anything like this many open. */
const MAX_SHOWN = 200;

const TONES = { REMINDER: "info", ESCALATION: "danger" } as const;

/**
 * Reminders and escalations that have really gone out to this person or their
 * role. They belong to the person, so this shows above whichever role's list is
 * open, and it reaches a role with no list of its own. It appears only when
 * there is something to say.
 */
export function RemindersForYou() {
  const { t } = useTranslation("workflows");
  const query = useWorkflowsNoticesForMe({ pageSize: MAX_SHOWN });
  const notices = query.data?.data ?? [];
  if (!query.isError && notices.length === 0) return null;

  return (
    <SectionCard
      title={t("forYou.title")}
      description={t("forYou.description")}
      work
    >
      <QueryBoundary query={query}>
        <ul className="divide-y divide-border">
          {notices.map((notice) => (
            <li key={notice.id} className="space-y-1 py-3">
              <StatusBadge tone={TONES[notice.kind]}>
                {t(`forYou.kinds.${notice.kind}`)}
              </StatusBadge>
              <p className="fs-14 font-medium">
                {t(`forYou.messages.${notice.kind}`, {
                  task: t(`task.kinds.${notice.taskKind}`),
                  order: notice.orderNo,
                })}
              </p>
              <p className="fs-14 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                <RecordLink
                  to={`/workflows/orders/${notice.orderNo}`}
                  className="inline-flex min-h-6 items-center font-mono font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
                >
                  {notice.orderNo}
                </RecordLink>
                <span className="self-center">
                  {t("reminders.dueOn", { date: formatDate(notice.dueAt) })}
                </span>
                <span className="self-center">
                  {t("forYou.sentOn", { date: formatDateTime(notice.sentAt) })}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </QueryBoundary>
    </SectionCard>
  );
}
