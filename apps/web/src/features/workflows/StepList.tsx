import type { OrderStep } from "@orderpilot/shared";
import { Circle, CircleCheck, CircleDot, CircleSlash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/common";
import { formatDate } from "./format";

const ICONS = {
  done: CircleCheck,
  current: CircleDot,
  upcoming: Circle,
  skipped: CircleSlash,
} as const;

/** The steps an order passes through, in order, with where it is now. */
export function StepList({ steps }: { steps: readonly OrderStep[] }) {
  const { t } = useTranslation(["workflows", "common"]);
  return (
    <ol className="space-y-2">
      {steps.map((step) => {
        const Icon = ICONS[step.state];
        return (
          <li
            key={step.key}
            aria-current={step.state === "current" ? "step" : undefined}
            className="flex items-start gap-3 rounded-lg border p-s2 data-[current=true]:border-primary"
            data-current={step.state === "current"}
          >
            <Icon
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t(`steps.${step.key}`)}</span>
                <StatusBadge
                  tone={
                    step.overdue
                      ? "danger"
                      : step.state === "done"
                        ? "success"
                        : step.state === "current"
                          ? "info"
                          : "neutral"
                  }
                >
                  {step.overdue
                    ? t("task.overdue")
                    : t(`order.stepState.${step.state}`)}
                </StatusBadge>
                {step.optional ? (
                  <span className="text-xs text-muted-foreground">
                    {t("order.optional")}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("order.owner", {
                  role: t(`roles.${step.ownerRole}`, { ns: "common" }),
                })}
                {" · "}
                {step.completedAt
                  ? t("order.doneOn", { date: formatDate(step.completedAt) })
                  : t("task.dueOn", { date: formatDate(step.dueAt ?? "") })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
