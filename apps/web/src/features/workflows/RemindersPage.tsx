import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/common";
import {
  useWorkflowsInboxReminders,
  useWorkflowsMyReminders,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { formatDate } from "./format";
import { MockBadges } from "./MockBadges";
import { QueryBoundary } from "./QueryBoundary";
import { RolePicker } from "./RolePicker";
import { useInboxRole } from "./useInboxRole";
import { WorkflowNav } from "./WorkflowNav";

const TONES = {
  scheduled: "neutral",
  sent: "info",
  escalated: "danger",
} as const;

/** Reminders for a role: what is due, who has been told, and where it goes next. */
export default function RemindersPage() {
  const { t } = useTranslation(["workflows", "common"]);
  const { role, mayPick, setRole } = useInboxRole();
  const mine = useWorkflowsMyReminders(undefined, {
    query: { enabled: !mayPick && role !== undefined },
  });
  const theirs = useWorkflowsInboxReminders(role ?? "SUPPORT", undefined, {
    query: { enabled: mayPick },
  });
  const query = mayPick ? theirs : mine;
  const reminders = query.data?.data ?? [];

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("reminders.heading")}
        description={t("reminders.description")}
        meta={<MockBadges mock={query.data?.meta.mock} />}
      />
      <WorkflowNav />
      {mayPick ? (
        <RolePicker value={role ?? "SUPPORT"} onChange={setRole} />
      ) : null}
      <SectionCard title={t("reminders.heading")}>
        <QueryBoundary query={query}>
          {reminders.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title={t("reminders.emptyTitle")}
              description={t("reminders.emptyDescription")}
            />
          ) : (
            <ul className="space-y-s2">
              {reminders.map((reminder) => (
                <li
                  key={reminder.id}
                  className="space-y-2 rounded-xl border p-s3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t(`reminders.kinds.${reminder.kind}`)}
                    </span>
                    <StatusBadge tone={TONES[reminder.stage]}>
                      {t(`reminders.stages.${reminder.stage}`)}
                    </StatusBadge>
                  </div>
                  <p className="font-medium">{reminder.message}</p>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <Link
                      to={`/workflows/orders/${reminder.orderNo}`}
                      className="inline-flex min-h-11 items-center font-mono text-primary underline-offset-4 hover:underline"
                    >
                      {reminder.orderNo}
                    </Link>
                    <span className="self-center">
                      {t("reminders.dueOn", {
                        date: formatDate(reminder.dueAt),
                      })}
                    </span>
                    <span className="self-center">
                      {t("reminders.remindOn", {
                        date: formatDate(reminder.remindAt),
                      })}
                    </span>
                    {reminder.escalatesAt ? (
                      <span className="self-center">
                        {t("reminders.escalatesOn", {
                          date: formatDate(reminder.escalatesAt),
                        })}
                      </span>
                    ) : null}
                    {reminder.escalatedTo ? (
                      <span className="self-center">
                        {t("reminders.escalatedTo", {
                          role: t(`roles.${reminder.escalatedTo}`, {
                            ns: "common",
                          }),
                        })}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </SectionCard>
    </div>
  );
}
