import type { WorkflowTask } from "@orderpilot/shared";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Money } from "@/components/common";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HOME_FIRST_CELL, homeCell } from "./HomeTable";
import { isOneClick } from "./useTaskAction";

/** One task: what it is, its order, who for, how much, when, and the one thing to do. */
export function TaskRow({
  task,
  touch,
  busy,
  onAct,
}: {
  task: WorkflowTask;
  touch: boolean;
  busy: boolean;
  onAct: () => void;
}) {
  const { t } = useTranslation("home");
  const size = touch ? "default" : "sm";
  const targetClass = touch ? "min-h-11" : undefined;
  return (
    <tr>
      <td className={HOME_FIRST_CELL}>{task.title}</td>
      <td className={homeCell({})}>
        {task.orderNo ? (
          <Link
            to={`/order-tracker/${task.orderNo}`}
            className="inline-flex min-h-6 items-center font-mono text-primary underline-offset-4 hover:underline"
          >
            {task.orderNo}
          </Link>
        ) : null}
      </td>
      <td className={cn(homeCell({}), "md:min-w-32 md:whitespace-normal")}>
        {task.customerName}
      </td>
      <td className={homeCell({ end: true })}>
        {task.amount ? (
          <Money value={task.amount} currency={task.currencyCode} />
        ) : null}
      </td>
      <td className={homeCell({})}>
        <span
          className={cn(
            "inline-flex items-center gap-1 tabular-nums",
            task.overdue && "font-medium text-destructive",
          )}
        >
          {task.overdue ? (
            <Clock className="size-3.5" aria-hidden="true" />
          ) : null}
          {formatDay(task.dueAt)}
          {task.overdue ? (
            <span className="sr-only">{t("needs.overdue")}</span>
          ) : null}
        </span>
      </td>
      <td className={homeCell({ action: true })}>
        {isOneClick(task) ? (
          <Button
            variant="outline"
            size={size}
            className={targetClass}
            disabled={busy}
            aria-label={t("needs.actionOn", {
              action: t(`needs.actions.${task.kind}`),
              what: task.orderNo,
            })}
            onClick={onAct}
          >
            {t(`needs.actions.${task.kind}`)}
          </Button>
        ) : (
          <Link
            to={`/order-tracker/${task.orderNo ?? ""}`}
            className={cn(
              buttonVariants({ variant: "outline", size }),
              targetClass,
            )}
            aria-label={t("needs.actionOn", {
              action: t("needs.actions.REVIEW_FIELDS"),
              what: task.orderNo,
            })}
          >
            {t("needs.actions.REVIEW_FIELDS")}
          </Link>
        )}
      </td>
    </tr>
  );
}
