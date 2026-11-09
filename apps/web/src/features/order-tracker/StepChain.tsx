import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimelineStep } from "@orderpilot/shared";
import { EmptyState, RelativeTime, SectionCard } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Every step of the order as a chain, with what each one changed, in our own
 * words ("Payment confirmed: packing released"). The text comes from the API.
 * Money postings are made in Navision, and the heading says so.
 */
export function StepChain({ steps }: { steps: readonly TimelineStep[] }) {
  const { t } = useTranslation("order-tracker");
  return (
    <SectionCard
      title={t("detail.steps.title")}
      description={t("detail.steps.description")}
    >
      {steps.length === 0 ? (
        <EmptyState icon={History} title={t("detail.steps.empty")} />
      ) : (
        <ol className="relative space-y-s3 border-l">
          {steps.map((step) => (
            <li key={step.id} className="relative pl-s3">
              <span
                aria-hidden="true"
                className={cn(
                  "absolute -left-[6px] top-1.5 size-2.5 rounded-full border bg-background",
                  step.current && "border-primary bg-primary",
                )}
              />
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{step.title}</h3>
                {step.current ? (
                  <Badge>{t("detail.steps.current")}</Badge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {step.actor} <span aria-hidden="true">-</span>{" "}
                <RelativeTime value={step.at} />
              </p>
              <p className="measure">
                <span className="text-muted-foreground">
                  {t("detail.steps.effect")}:
                </span>{" "}
                {step.effect}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
