import type { WorkflowTask } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RecordLink, StatusBadge } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate, formatQuantity, isToday } from "./format";
import { RecordRefLine } from "./RecordRefLine";

function targetOf(task: WorkflowTask): string | null {
  if (task.ref) return `/workflows/sprs/${task.ref.recordNo}`;
  if (task.orderNo) return `/workflows/orders/${task.orderNo}`;
  return null;
}

function dueText(task: WorkflowTask, t: TFunction<"workflows">): string {
  return isToday(task.dueAt)
    ? t("task.dueToday")
    : t("task.dueOn", { date: formatDate(task.dueAt) });
}

/** What an SPR task would buy, flagged when the item has under a month of stock. */
function SprLine({ spr }: { spr: NonNullable<WorkflowTask["spr"]> }) {
  const { t } = useTranslation("workflows");
  const cover = spr.monthsOfCover;
  return (
    <>
      <span className="text-foreground">
        {t("task.sprLine", {
          quantity: formatQuantity(spr.quantity),
          item: spr.itemDescription,
        })}
      </span>
      {cover !== null && Number(cover) < 1 ? (
        <StatusBadge tone="warning">{t("spr.lowCover")}</StatusBadge>
      ) : (
        <span>
          {cover === null
            ? t("spr.noSales")
            : t("task.cover", { months: formatAmount(cover) })}
        </span>
      )}
    </>
  );
}

/**
 * One task. Its single action opens the SPR for an SPR task and the order for
 * the rest. At a desk it is one compact row in a list, led by what tells tasks
 * apart (the customer and the amount), with a quiet action, so a long inbox
 * fits on a screen and no row shouts. `touch` is the warehouse's tablet
 * layout: a taller row with bigger text and a full width action, every target 44 px.
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
  const target = targetOf(task);
  const action =
    target && canOpen ? (
      <RecordLink
        to={target}
        className={cn(
          touch
            ? cn(buttonVariants({ size: "lg" }), "min-h-14 w-full text-base")
            : cn(buttonVariants({ variant: "outline" }), "min-h-11 shrink-0"),
        )}
      >
        {task.ref ? t("task.openRequest") : t("task.openOrder")}
        <ArrowRight aria-hidden="true" />
      </RecordLink>
    ) : null;

  if (touch) {
    return (
      <li className="flex flex-col gap-s2 py-s4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t(`task.kinds.${task.kind}`)}
            </span>
            {task.overdue ? (
              <StatusBadge tone="danger">{t("task.overdue")}</StatusBadge>
            ) : null}
          </div>
          <h3 className="text-xl font-semibold">{task.title}</h3>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {task.orderNo ? (
              <span>
                {t("task.order")}{" "}
                <span data-numeric className="font-mono text-foreground">
                  {task.orderNo}
                </span>
              </span>
            ) : null}
            <span>{dueText(task, t)}</span>
          </p>
          {task.ref ? <RecordRefLine value={task.ref} /> : null}
          {note ? <p className="text-sm">{note}</p> : null}
        </div>
        {action}
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-s2 py-s2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{task.customerName ?? task.title}</h3>
          {task.overdue ? (
            <StatusBadge tone="danger">{t("task.overdue")}</StatusBadge>
          ) : null}
        </div>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {/* An SPR row says what it buys; the task's title would only repeat "approve the SPR". */}
          {task.spr ? (
            <SprLine spr={task.spr} />
          ) : task.customerName ? (
            <span>{task.title}</span>
          ) : null}
          {task.orderNo ? (
            <span data-numeric className="font-mono text-foreground">
              {task.orderNo}
            </span>
          ) : null}
          {task.ref ? (
            <span data-numeric className="font-mono">
              {task.ref.recordNo}
            </span>
          ) : null}
          {/* Business Central's number beside ours once it exists; "none yet" on every row is noise. */}
          {task.ref?.navisionNo ? (
            <span>
              {t("task.navision")}:{" "}
              <span data-numeric className="font-mono">
                {task.ref.navisionNo}
              </span>
            </span>
          ) : null}
          <span className={cn(task.overdue && "text-destructive")}>
            {dueText(task, t)}
          </span>
        </p>
        {note ? <p className="text-sm">{note}</p> : null}
      </div>
      {task.amount && task.currencyCode ? (
        <span
          data-numeric
          className="shrink-0 text-sm font-medium tabular-nums sm:w-32 sm:text-right"
        >
          {task.currencyCode} {formatAmount(task.amount)}
        </span>
      ) : null}
      {action}
    </li>
  );
}
