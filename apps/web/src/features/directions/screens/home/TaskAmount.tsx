import { compareDecimal, type WorkflowTask } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/format";
import { Amount } from "../orders/Amount";
import { usePriceAccess } from "./usePriceAccess";

/**
 * The money on a task, with what it is said in small words before the figure:
 * the SPR's own amount on an SPR task, what is due (and the order's total
 * after it, so a person never confirms a part believing it is the whole) on a
 * payment, and otherwise the order's value. A role whose prices are masked
 * sees the Orders page's mask in the figure's place, with the same reason, so
 * a missing figure is never unexplained. It wraps nowhere: the figure is what
 * they are about to act on. Nothing is drawn while the answer about prices
 * is unknown, so a figure is never shown first and taken back.
 */
export function TaskAmount({ task }: { task: WorkflowTask }) {
  const { t } = useTranslation("directions-home");
  const access = usePriceAccess();
  if (access.state === "unknown") return null;

  const paying = task.expectedPayment;
  const whole = task.amount
    ? formatMoney(task.amount, task.currencyCode ?? paying?.currencyCode)
    : null;
  let label = t("needs.amount.orderValue");
  let figure = whole;
  if (task.kind === "RAISE_SPR" || task.kind === "APPROVE_SPR") {
    label = t("needs.amount.spr");
  } else if (paying) {
    label = t("needs.amount.due");
    const part = formatMoney(paying.amount, paying.currencyCode);
    const same =
      task.amount !== undefined &&
      compareDecimal(paying.amount, task.amount) === 0;
    figure =
      whole === null || same ? part : t("needs.amount.of", { part, whole });
  }
  if (figure === null) return null;
  return (
    <span className="fs-14 numeral whitespace-nowrap text-muted-foreground">
      <span className="fs-12">{label}</span>{" "}
      {access.state === "masked" ? (
        // The figure itself is not read: the server hides it from this role.
        <Amount
          field={{ masked: true, value: null, reason: access.reason }}
          currency={task.currencyCode ?? paying?.currencyCode ?? "USD"}
        />
      ) : (
        figure
      )}
    </span>
  );
}
