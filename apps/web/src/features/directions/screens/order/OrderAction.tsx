import type { WorkflowTask } from "@orderpilot/shared";
import { ArrowRight, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DueTimer } from "../../parts/DueTimer";
import { canComplete, useCompleteTask } from "../home/useCompleteTask";

/**
 * The page's one primary button: the person's own open task on this order. A
 * task that one click finishes (send the PI, mark packed) is finished here, as
 * on the home screen, with the app's own toast and Undo. A decision (approve an
 * SPR, confirm a payment) is made on the order's steps page of the app, so the
 * button opens that page. When the person has no task on the order, there is
 * no button, and a line says so.
 */
export function OrderAction({
  task,
  orderNo,
  pending,
}: {
  task: WorkflowTask | null;
  orderNo: string;
  pending: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const { t: tHome } = useTranslation("home");
  const completion = useCompleteTask({
    onDone: () => undefined,
    onUndone: () => undefined,
  });
  if (pending) return null;
  if (!task) {
    return (
      <p className="od-no-action fs-14 text-muted-foreground">
        {t("action.none")}
      </p>
    );
  }
  const verb = tHome(`needs.actions.${task.kind}`);
  const due = <DueTimer due={task.dueAt} />;
  return (
    <>
      {canComplete(task) ? (
        <Button
          className="pointer-coarse:h-11"
          disabled={completion.isBusy(task)}
          onClick={() => {
            completion.complete(task);
          }}
        >
          <Check aria-hidden="true" />
          {verb}
        </Button>
      ) : (
        <Button asChild className="pointer-coarse:h-11">
          <Link to={`/workflows/orders/${encodeURIComponent(orderNo)}`}>
            {verb}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      )}
      <span className="od-action-due fs-14">
        <span className="text-muted-foreground">{t("action.yourTask")}</span>
        {due}
      </span>
    </>
  );
}
