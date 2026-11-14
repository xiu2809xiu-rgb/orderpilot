import type { WorkflowTask } from "@orderpilot/shared";
import { ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DueTimer } from "@/components/parts/DueTimer";
import { HomeRow } from "./HomeRow";
import { RecordLinkText } from "./RecordLinkText";
import { TaskAmount } from "./TaskAmount";
import { useOrderLinks } from "./homeLinks";
import { isOneClick } from "./useCompleteTask";

interface NeedRowProps {
  task: WorkflowTask;
  busy: boolean;
  onComplete: () => void;
}

/**
 * One task waiting for the person: what to do, which order and customer, how
 * long until it is due, the money when there is some, and one action. A task
 * that one click does has that button; any other opens its order, where it is
 * reviewed or decided.
 */
export function NeedRow({ task, busy, onComplete }: NeedRowProps) {
  const { t } = useTranslation("directions-home");
  const { t: tHome } = useTranslation("home");
  const links = useOrderLinks();
  const order = task.orderNo;
  const doIt = isOneClick(task);
  const verb = tHome(`needs.actions.${doIt ? task.kind : "REVIEW_FIELDS"}`);
  const target = "pointer-coarse:min-h-11";
  const sprPath = task.ref
    ? `/workflows/sprs/${encodeURIComponent(task.ref.recordNo)}`
    : null;
  // A task with no order still has its SPR to open.
  const href = order ? links.order(order) : sprPath;
  const what = order ?? task.ref?.recordNo ?? "";
  // On an SPR task the SPR is the thing to open, so its number is the title and the link.
  const sprLink =
    task.kind === "RAISE_SPR" || task.kind === "APPROVE_SPR" ? sprPath : null;
  return (
    <HomeRow
      title={
        sprLink ? (
          <RecordLinkText to={sprLink}>
            {t(`needs.sprTask.${task.kind}`, { recordNo: task.ref?.recordNo })}
          </RecordLinkText>
        ) : (
          t(`needs.kind.${task.kind}`)
        )
      }
      meta={
        <>
          {order ? (
            <RecordLinkText to={links.order(order)}>{order}</RecordLinkText>
          ) : null}
          {task.customerName ? (
            <span className="min-w-0 truncate" title={task.customerName}>
              {task.customerName}
            </span>
          ) : null}
        </>
      }
      trailing={
        <>
          <DueTimer due={task.dueAt} />
          <TaskAmount task={task} />
        </>
      }
      action={
        doIt ? (
          <Button
            variant="outline"
            size="sm"
            data-task-action
            className={`${target} w-full`}
            disabled={busy}
            aria-label={t("needs.actionOn", { action: verb, order: what })}
            onClick={onComplete}
          >
            <Check aria-hidden="true" />
            {verb}
          </Button>
        ) : href ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className={`${target} w-full`}
          >
            <Link
              to={href}
              data-task-action
              aria-label={t("needs.actionOn", { action: verb, order: what })}
            >
              {verb}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null
      }
    />
  );
}
