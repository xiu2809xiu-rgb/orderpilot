import type { WorkflowTask } from "@orderpilot/shared";
import { ArrowRight, Check } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { DueTimer } from "@/components/parts/DueTimer";
import { stepsHref } from "../home/homeLinks";
import { canComplete, useCompleteTask } from "../home/useCompleteTask";
import { useDoneToday } from "../home/useDoneToday";
import { TaskTip } from "../home/TaskTip";
import { ReviewNotice } from "./ReviewNotice";

/**
 * The page's one primary button: the person's own open task on this order, in
 * the same words as Home's row for the same task (the `directions-home` keys),
 * with the same line that says what it records. A task that one click finishes
 * (send the PI, mark packed) is finished here, as on Home, with the app's own
 * toast and Undo, and is noted in Done today. An SPR is decided on its own
 * page, so its button says Review and opens the SPR. A payment is entered on
 * the order's steps page, where the form asks for the amount, the bank
 * reference and the date, so its button opens that page. The task that confirms
 * the fields has no screen for a stored document, so a notice stands in its
 * place, with the task's due time beside it. When a person who holds tasks has none on this order, there is no
 * button, and a line says so.
 */
export function OrderAction({
  task,
  orderNo,
  pending,
  hasInbox,
}: {
  task: WorkflowTask | null;
  orderNo: string;
  pending: boolean;
  hasInbox: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  const { t: tHome } = useTranslation("directions-home");
  const recordsId = useId();
  const { record, forget } = useDoneToday();
  const completion = useCompleteTask({
    onDone: record,
    onUndone: forget,
    offerOrder: false,
  });
  // A role with no inbox (the auditor, management) has no task to be told about.
  if (pending || !hasInbox) return null;
  if (!task) {
    return (
      <p className="od-no-action fs-14 text-muted-foreground">
        {t("action.none")}
      </p>
    );
  }
  const verb = tHome(`needs.actions.${task.kind}`);
  // The same line for every task, so the notice for the fields keeps the due time Home shows.
  const dueLine = (
    <span className="od-action-due fs-14">
      <span className="text-muted-foreground">{t("action.yourTask")}</span>
      <DueTimer due={task.dueAt} />
    </span>
  );
  const paying = task.kind === "CONFIRM_PAYMENT";
  const records = tHome(
    `needs.records.${task.kind === "RAISE_SPR" || paying ? task.kind : "default"}`,
  );
  const caption = (
    <span id={recordsId} className="sr-only">
      {records}
    </span>
  );
  if (task.kind === "REVIEW_FIELDS") {
    return (
      <>
        <ReviewNotice />
        {dueLine}
      </>
    );
  }
  return (
    <>
      {canComplete(task) ? (
        <TaskTip hint={records}>
          <Button
            className="pointer-coarse:h-11"
            disabled={completion.isBusy(task)}
            aria-describedby={recordsId}
            onClick={() => {
              completion.complete(task);
            }}
          >
            <Check aria-hidden="true" />
            {verb}
          </Button>
        </TaskTip>
      ) : (
        <TaskTip hint={records} enabled={paying}>
          <Button asChild className="pointer-coarse:h-11">
            <Link
              to={
                task.ref
                  ? `/workflows/sprs/${encodeURIComponent(task.ref.recordNo)}`
                  : stepsHref(orderNo)
              }
              aria-describedby={paying ? recordsId : undefined}
            >
              {verb}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </TaskTip>
      )}
      {/* Beside the button, not inside it, so the line describes the button and is not part of its name. */}
      {canComplete(task) || paying ? caption : null}
      {dueLine}
    </>
  );
}
