import type { WorkflowTask } from "@orderpilot/shared";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RecordLink, StatusBadge } from "@/components/common";
import { DueTimer } from "@/components/parts/DueTimer";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "./format";
import { RecordRefLine } from "./RecordRefLine";

/**
 * One task as a row of the inbox: what to do, the order as a link, when it is
 * due, and one outline action. The action opens the SPR for an SPR task and
 * the order for the rest. `touch` is the warehouse's tablet layout: bigger
 * text and a full width action, and every target is at least 44 px either way.
 */
export function TaskCard({
  task,
  touch,
  note,
  canOpen = true,
}: {
  task: WorkflowTask;
  touch: boolean;
  /** Why this task is here, when that is not obvious from the task. */
  note?: string;
  /** False when the person's role would be refused the page it links to. */
  canOpen?: boolean;
}) {
  const { t } = useTranslation("workflows");
  const target = task.ref
    ? `/workflows/sprs/${task.ref.recordNo}`
    : task.orderNo
      ? `/workflows/orders/${task.orderNo}`
      : null;
  return (
    <li
      className={cn(
        "grid grid-cols-1 items-center gap-x-4 gap-y-2",
        touch ? "py-s4" : "py-3 sm:grid-cols-[minmax(0,1fr)_auto_9.5rem]",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t(`task.kinds.${task.kind}`)}
          </span>
          {task.overdue ? (
            <StatusBadge tone="danger">{t("task.overdue")}</StatusBadge>
          ) : null}
        </div>
        <h3 className={cn("font-medium", touch ? "fs-20" : "fs-14")}>
          {task.title}
        </h3>
        <div className="fs-14 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-muted-foreground">
          {task.orderNo ? (
            <span>
              {t("task.order")}{" "}
              <RecordLink
                to={`/workflows/orders/${task.orderNo}`}
                data-numeric
                className="inline-flex min-h-6 items-center font-mono font-medium text-primary underline-offset-4 hover:underline pointer-coarse:min-h-11"
              >
                {task.orderNo}
              </RecordLink>
            </span>
          ) : null}
          {task.customerName ? (
            <span className="min-w-0 truncate" title={task.customerName}>
              {task.customerName}
            </span>
          ) : null}
          {task.ref ? <RecordRefLine value={task.ref} /> : null}
        </div>
        {note ? <p className="fs-14">{note}</p> : null}
      </div>
      <span
        title={t("task.dueOn", { date: formatDate(task.dueAt) })}
        className={cn(touch ? "justify-self-start" : "sm:justify-self-end")}
      >
        <DueTimer due={task.dueAt} />
      </span>
      {target && canOpen ? (
        <RecordLink
          to={target}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "min-h-9 w-full pointer-coarse:min-h-11",
            touch && "min-h-14 text-base",
          )}
        >
          {task.ref ? t("task.openRequest") : t("task.openOrder")}
          <ArrowRight aria-hidden="true" />
        </RecordLink>
      ) : null}
    </li>
  );
}
