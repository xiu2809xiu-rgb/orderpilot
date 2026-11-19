import type { WorkflowTask } from "@orderpilot/shared";
import { ArrowRight, Check, ClipboardPlus } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DueTimer } from "@/components/parts/DueTimer";
import { HomeRow } from "./HomeRow";
import { RecordLinkText } from "./RecordLinkText";
import { SprDetail } from "./SprDetail";
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
 * that one click does has that button; any other opens its record, where it is
 * reviewed or decided. An SPR is never approved from the row. The action
 * carries the task's kind and id, which the demo tour finds it by.
 */
export function NeedRow({ task, busy, onComplete }: NeedRowProps) {
  const { t } = useTranslation("directions-home");
  const links = useOrderLinks();
  const order = task.orderNo;
  const doIt = isOneClick(task);
  const verb = t(`needs.actions.${doIt ? task.kind : "REVIEW_FIELDS"}`);
  const recordsId = useId();
  // The button says what it records, and a screen reader hears what it does not do.
  const records = t(
    `needs.records.${task.kind === "RAISE_SPR" || task.kind === "CONFIRM_PAYMENT" ? task.kind : "default"}`,
  );
  const Icon = task.kind === "RAISE_SPR" ? ClipboardPlus : Check;
  const target = "pointer-coarse:min-h-11";
  const sprPath = task.ref
    ? `/workflows/sprs/${encodeURIComponent(task.ref.recordNo)}`
    : null;
  // An SPR opens on its own page, where it is decided; the rest open their order.
  const href = sprPath ?? (order ? links.order(order) : null);
  const what = order ?? task.ref?.recordNo ?? "";
  // On an SPR task the SPR is the thing to open, so its number is the title and the link.
  const sprLink = task.kind === "APPROVE_SPR" ? sprPath : null;
  const sprTask = task.kind === "RAISE_SPR" || task.kind === "APPROVE_SPR";
  // What the person must do and for which order; an SPR's number is its detail.
  const doing =
    task.kind === "RAISE_SPR" && order
      ? t("needs.raiseSpr", { orderNo: order })
      : t(`needs.kind.${task.kind}`);
  const title = sprLink ? (
    <RecordLinkText to={sprLink}>
      {t(`needs.sprTask.${task.kind}`, { recordNo: task.ref?.recordNo })}
    </RecordLinkText>
  ) : (
    doing
  );
  return (
    <HomeRow
      title={title}
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
      detail={
        sprTask ? (
          <SprDetail task={task} showRef={sprLink === null} />
        ) : undefined
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
            data-task-kind={task.kind}
            data-task-id={task.id}
            data-order={order ?? undefined}
            className={`${target} w-full`}
            disabled={busy}
            aria-label={t("needs.actionOn", { action: verb, order: what })}
            aria-describedby={recordsId}
            onClick={onComplete}
          >
            <Icon aria-hidden="true" />
            {verb}
            <span id={recordsId} className="sr-only">
              {records}
            </span>
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
              data-task-kind={task.kind}
              data-task-id={task.id}
              data-order={order ?? undefined}
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
