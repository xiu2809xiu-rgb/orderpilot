import type { WorkflowTask } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RecordLink, StatusBadge } from "@/components/common";
import {
  stepsHref,
  useOrderLinks,
} from "@/features/directions/screens/home/homeLinks";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatAmount, formatDate, isToday } from "./format";
import { RecordRefLine } from "./RecordRefLine";
import { SprLine } from "./SprLine";

/**
 * Where a task leads, as from Home (#290): an SPR task to the SPR, a payment
 * to the steps page that holds the payment form, and the rest to the order's
 * own page, or the nearest page the role may open.
 */
function targetOf(
  task: WorkflowTask,
  orderPage: (orderNo: string) => string,
): string | null {
  if (task.ref) return `/workflows/sprs/${task.ref.recordNo}`;
  if (!task.orderNo) return null;
  return task.kind === "CONFIRM_PAYMENT"
    ? stepsHref(task.orderNo)
    : orderPage(task.orderNo);
}

function dueText(task: WorkflowTask, t: TFunction<"workflows">): string {
  return isToday(task.dueAt)
    ? t("task.dueToday")
    : t("task.dueOn", { date: formatDate(task.dueAt) });
}

/**
 * One task. Its single action opens the SPR for an SPR task and the order for
 * the rest. At a desk it is one compact row in a list, led by what tells tasks
 * apart (the customer and the amount), with a quiet action, so a long inbox
 * fits on a screen and no row shouts. `touch` is the warehouse's tablet
 * layout: the same row with bigger text, every target 44 px. A task is worded
 * as Home words it.
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
  const { t: tHome } = useTranslation("directions-home");
  const links = useOrderLinks();
  const target = targetOf(task, links.order);
  // Worded as Home words it, so one task reads the same on both pages (#290).
  const what = tHome(`needs.kind.${task.kind}`);
  const action =
    target && canOpen ? (
      <RecordLink
        to={target}
        className={cn(
          touch
            ? // Outline, as at a desk: twenty bright primary buttons in one inbox
              // would leave no primary action on the page.
              cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-h-11 w-full shrink-0 text-base sm:w-auto",
              )
            : cn(buttonVariants({ variant: "outline" }), "min-h-11 shrink-0"),
        )}
      >
        {task.ref
          ? t("task.openRequest")
          : task.kind === "CONFIRM_PAYMENT"
            ? tHome("needs.actions.CONFIRM_PAYMENT")
            : t("task.openOrder")}
        <ArrowRight aria-hidden="true" />
      </RecordLink>
    ) : null;

  if (touch) {
    // Two or three to a screen was too few for the warehouse floor (#290): one
    // row led by the customer, as at a desk, with bigger text and 44 px targets.
    return (
      <li className="flex flex-col gap-s2 py-s3 sm:flex-row sm:items-center sm:gap-s3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold">
              {task.customerName ?? what}
            </h3>
            {task.overdue ? (
              <StatusBadge tone="danger">{t("task.overdue")}</StatusBadge>
            ) : null}
          </div>
          <p className="flex dx-measure flex-wrap items-baseline gap-x-4 gap-y-1 text-base text-muted-foreground">
            {task.customerName ? (
              <span className="text-foreground">{what}</span>
            ) : null}
            {task.orderNo ? (
              <span data-numeric className="font-mono text-foreground">
                {task.orderNo}
              </span>
            ) : null}
            <span className={cn(task.overdue && "text-destructive")}>
              {dueText(task, t)}
            </span>
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
          <h3 className="font-semibold">{task.customerName ?? what}</h3>
          {task.overdue ? (
            <StatusBadge tone="danger">{t("task.overdue")}</StatusBadge>
          ) : null}
        </div>
        <p className="flex dx-measure flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {/* An SPR row says what it buys; the task's title would only repeat "approve the SPR". */}
          {task.spr ? (
            <SprLine spr={task.spr} />
          ) : task.customerName ? (
            <span>{what}</span>
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
