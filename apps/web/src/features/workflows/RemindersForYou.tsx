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
    >
      <QueryBoundary query={query}>
        <ul className="space-y-s2">
          {notices.map((notice) => (
            <li key={notice.id} className="space-y-2 rounded-xl border p-s3">
              <StatusBadge tone={TONES[notice.kind]}>
                {t(`forYou.kinds.${notice.kind}`)}
              </StatusBadge>
              <p className="font-medium">
                {t(`forYou.messages.${notice.kind}`, {
                  task: t(`task.kinds.${notice.taskKind}`),
                  order: notice.orderNo,
                })}
              </p>
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <RecordLink
                  to={`/workflows/orders/${notice.orderNo}`}
                  className="inline-flex min-h-11 items-center font-mono text-primary underline-offset-4 hover:underline"
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
