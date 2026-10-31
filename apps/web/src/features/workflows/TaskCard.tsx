import type { WorkflowTask } from "@orderpilot/shared";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { StatusBadge } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate } from "./format";
import { RecordRefLine } from "./RecordRefLine";

/**
 * One task. Its single action opens the SPR for an SPR task and the order for
 * the rest. `touch` is the warehouse's tablet layout: bigger text and a full
 * width action, and every target is at least 44 px either way.
 */
export function TaskCard({
  task,
  touch,
}: {
  task: WorkflowTask;
  touch: boolean;
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
        "flex flex-col gap-s2 rounded-xl bg-card shadow-card",
        touch ? "p-s4" : "p-s3 sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t(`task.kinds.${task.kind}`)}
          </span>
          {task.overdue ? (
            <StatusBadge tone="danger">{t("task.overdue")}</StatusBadge>
          ) : null}
        </div>
        <h3 className={cn("font-semibold", touch ? "text-xl" : "text-base")}>
          {task.title}
        </h3>
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {task.orderNo ? (
            <span>
              {t("task.order")}{" "}
              <span data-numeric className="font-mono text-foreground">
                {task.orderNo}
              </span>
            </span>
          ) : null}
          <span>{t("task.dueOn", { date: formatDate(task.dueAt) })}</span>
        </p>
        {task.ref ? <RecordRefLine value={task.ref} /> : null}
      </div>
      {target ? (
        <Link
          to={target}
          className={cn(
            buttonVariants({ size: "lg" }),
            "min-h-11 shrink-0",
            touch && "min-h-14 w-full text-base",
          )}
        >
          {task.ref ? t("task.openRequest") : t("task.openOrder")}
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : null}
    </li>
  );
}
