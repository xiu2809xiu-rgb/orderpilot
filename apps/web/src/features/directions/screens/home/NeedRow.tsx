import type { WorkflowTask } from "@orderpilot/shared";
import { ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DueTimer } from "@/components/parts/DueTimer";
import { orderHref } from "./homeLinks";
import { canComplete } from "./useCompleteTask";

interface NeedRowProps {
  task: WorkflowTask;
  busy: boolean;
  onComplete: () => void;
}

/**
 * One task waiting for the person: what to do, which order and customer, how
 * long until it is due, and one action. A task that one click finishes has
 * that button; any other opens its order.
 */
export function NeedRow({ task, busy, onComplete }: NeedRowProps) {
  const { t } = useTranslation("directions-home");
  const { t: tHome } = useTranslation("home");
  const order = task.orderNo;
  const kind = t(`needs.kind.${task.kind}`);
  const doIt = canComplete(task);
  const verb = tHome(`needs.actions.${task.kind}`);
  const target = "pointer-coarse:min-h-11";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-border py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_7.5rem]">
      <div className="min-w-0">
        <p className="fs-14 font-medium text-foreground">{kind}</p>
        <p className="fs-14 flex min-w-0 gap-1.5 text-muted-foreground">
          {order ? (
            <Link
              to={orderHref(order)}
              className="numeral shrink-0 text-ring underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              {order}
            </Link>
          ) : null}
          {task.customerName ? (
            <span className="truncate">{task.customerName}</span>
          ) : null}
        </p>
      </div>
      <DueTimer due={task.dueAt} className="justify-self-end" />
      <div className="col-span-2 sm:col-span-1 sm:justify-self-end">
        {doIt ? (
          <Button
            variant="outline"
            size="sm"
            className={target}
            disabled={busy}
            aria-label={t("needs.actionOn", { action: verb, order })}
            onClick={onComplete}
          >
            <Check aria-hidden="true" />
            {verb}
          </Button>
        ) : order ? (
          <Button asChild variant="outline" size="sm" className={target}>
            <Link
              to={orderHref(order)}
              aria-label={t("needs.actionOn", { action: verb, order })}
            >
              {verb}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
