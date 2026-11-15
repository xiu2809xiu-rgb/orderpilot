import type { WorkflowReminder } from "@orderpilot/shared";
import { BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  EmptyState,
  PageHeader,
  RecordLink,
  SectionCard,
  StatusBadge,
} from "@/components/common";
import {
  useWorkflowsInboxReminders,
  useWorkflowsMyReminders,
} from "@/lib/api/generated/endpoints/workflows/workflows";
import { formatDate } from "./format";
import { MockBadges } from "./MockBadges";
import { RemindersForYou } from "./RemindersForYou";
import { QueryBoundary } from "./QueryBoundary";
import { RolePicker } from "./RolePicker";
import { useInboxRole } from "./useInboxRole";
import { WorkflowNav } from "./WorkflowNav";

const TONES = {
  scheduled: "neutral",
  sent: "info",
  escalated: "danger",
} as const;

const LINK =
  "inline-flex items-center font-mono text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11";

/** A reminder opens the record it is about, such as its SPR, and else its order. */
function targetOf(reminder: WorkflowReminder): { to: string; label: string } {
  return reminder.ref
    ? {
        to: `/workflows/sprs/${reminder.ref.recordNo}`,
        label: reminder.ref.recordNo,
      }
    : { to: `/workflows/orders/${reminder.orderNo}`, label: reminder.orderNo };
}

/** One reminder in one compact row: what it is about, its dates, and its stage. */
function ReminderRow({ reminder }: { reminder: WorkflowReminder }) {
  const { t } = useTranslation(["workflows", "common"]);
  const target = targetOf(reminder);
  return (
    <li className="flex flex-col gap-1 py-s2 sm:flex-row sm:items-center sm:gap-s3">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{reminder.message}</p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {/* A due task says so in its message; the other kinds name themselves. */}
          {reminder.kind === "TASK_DUE" ? null : (
            <span>{t(`reminders.kinds.${reminder.kind}`)}</span>
          )}
          <RecordLink to={target.to} className={LINK}>
            {target.label}
          </RecordLink>
          <span>
            {t("reminders.dueOn", { date: formatDate(reminder.dueAt) })}
          </span>
          <span>
            {t("reminders.remindOn", { date: formatDate(reminder.remindAt) })}
          </span>
          {reminder.escalatesAt ? (
            <span>
              {t("reminders.escalatesOn", {
                date: formatDate(reminder.escalatesAt),
              })}
            </span>
          ) : null}
          {reminder.escalatedTo ? (
            <span>
              {t("reminders.escalatedTo", {
                role: t(`roles.${reminder.escalatedTo}`, { ns: "common" }),
              })}
            </span>
          ) : null}
        </p>
      </div>
      <span className="shrink-0">
        <StatusBadge tone={TONES[reminder.stage]}>
          {t(`reminders.stages.${reminder.stage}`)}
        </StatusBadge>
      </span>
    </li>
  );
}

/**
 * Reminders for a role: what is due, who has been told, and where it goes
 * next. What has already gone out to the person repeats much of the role's
 * list, so it folds away below it; a role with no list of its own sees it open.
 */
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
  const hasList = role !== undefined;

  return (
    <div className="space-y-s4">
      <PageHeader
        title={t("reminders.heading")}
        description={t("reminders.description")}
        meta={<MockBadges mock={query.data?.meta.mock} />}
      />
      <WorkflowNav />
      {hasList ? null : <RemindersForYou />}
      {mayPick ? (
        <RolePicker value={role ?? "SUPPORT"} onChange={setRole} />
      ) : null}
      <SectionCard
        title={
          role
            ? t("reminders.forRole", {
                role: t(`roles.${role}`, { ns: "common" }),
              })
            : t("reminders.heading")
        }
      >
        <QueryBoundary query={query}>
          {reminders.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title={t("reminders.emptyTitle")}
              description={t("reminders.emptyDescription")}
            />
          ) : (
            <ul className="divide-y divide-border">
              {reminders.map((reminder) => (
                <ReminderRow key={reminder.id} reminder={reminder} />
              ))}
            </ul>
          )}
        </QueryBoundary>
      </SectionCard>
      {hasList ? <RemindersForYou folded /> : null}
    </div>
  );
}
