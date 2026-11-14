import { compareDecimal, type WorkflowTask } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Money } from "@/components/common";
import { formatMoney } from "@/lib/format";

/**
 * The money on a task. On a payment, what the button confirms comes first and
 * the order's total after it, so a person never confirms a part believing it
 * is the whole. It wraps nowhere: the figure is what they are about to confirm.
 */
export function TaskAmount({ task }: { task: WorkflowTask }) {
  const { t } = useTranslation("home");
  const paying = task.expectedPayment;
  if (paying && task.amount) {
    const whole = task.currencyCode ?? paying.currencyCode;
    if (compareDecimal(paying.amount, task.amount) !== 0) {
      return (
        <span className="fs-14 numeral whitespace-nowrap text-muted-foreground">
          {t("needs.partOf", {
            part: formatMoney(paying.amount, paying.currencyCode),
            // The currency is said once when both figures share it.
            whole:
              whole === paying.currencyCode
                ? formatMoney(task.amount, "").trim()
                : formatMoney(task.amount, whole),
          })}
        </span>
      );
    }
  }
  if (!task.amount) return null;
  return (
    <Money
      value={task.amount}
      currency={task.currencyCode}
      className="fs-14 text-muted-foreground"
    />
  );
}
