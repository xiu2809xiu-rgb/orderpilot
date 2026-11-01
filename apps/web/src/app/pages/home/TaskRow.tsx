import { compareDecimal, type WorkflowTask } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { Clock } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Money } from "@/components/common";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDay, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CustomerName } from "./CustomerName";
import { isOneClick } from "./useTaskAction";

const LINK =
  "inline-flex min-h-6 items-center text-primary underline-offset-4 hover:underline";

/** On a payment, what the button confirms comes first, with the order's total after it. */
function amountOf(task: WorkflowTask, t: TFunction<"home">): ReactNode {
  const paying = task.expectedPayment;
  if (paying && task.amount) {
    const whole = task.currencyCode ?? paying.currencyCode;
    if (compareDecimal(paying.amount, task.amount) !== 0) {
      return (
        <span className="whitespace-nowrap tabular-nums">
          {t("needs.partOf", {
            part: formatMoney(paying.amount, paying.currencyCode),
            // The currency is said once when both figures share it: the cell is the widest one in the table.
            whole:
              whole === paying.currencyCode
                ? formatMoney(task.amount, "").trim()
                : formatMoney(task.amount, whole),
          })}
        </span>
      );
    }
  }
  return task.amount ? (
    <Money value={task.amount} currency={task.currencyCode} />
  ) : null;
}

/** The content of one task's row, by column. The table or the stack lays it out. */
export function taskCells(
  task: WorkflowTask,
  t: TFunction<"home">,
  { touch, busy, onAct }: { touch: boolean; busy: boolean; onAct: () => void },
): Record<string, ReactNode> {
  // Only a touch screen needs the 44 px target. A mouse keeps the row compact.
  const target = touch ? "pointer-coarse:min-h-11" : undefined;
  return {
    what: task.ref ? (
      <Link to={`/workflows/sprs/${task.ref.recordNo}`} className={LINK}>
        {t(`needs.sprTask.${task.kind}`, {
          recordNo: task.ref.recordNo,
          defaultValue: task.title,
        })}
      </Link>
    ) : (
      task.title
    ),
    order: task.orderNo ? (
      <Link
        to={`/order-tracker/${task.orderNo}`}
        className={cn(LINK, "font-mono")}
      >
        {task.orderNo}
      </Link>
    ) : null,
    customer: <CustomerName name={task.customerName} />,
    amount: amountOf(task, t),
    due: (
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
    ),
    action: isOneClick(task) ? (
      <Button
        variant="outline"
        size="sm"
        data-task-action
        className={target}
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
        data-task-action
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          target,
        )}
        aria-label={t("needs.actionOn", {
          action: t("needs.actions.REVIEW_FIELDS"),
          what: task.orderNo,
        })}
      >
        {t("needs.actions.REVIEW_FIELDS")}
      </Link>
    ),
  };
}
