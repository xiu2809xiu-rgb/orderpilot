import { ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ScrollRegion, SectionCard } from "@/components/common";
import { QueryBoundary } from "@/features/workflows/QueryBoundary";
import { useTrackerFlow } from "@/lib/api/generated/endpoints/tracker/tracker";
import { cn } from "@/lib/utils";

/**
 * The nine sales steps with the open orders at each, which add up to the Open
 * orders tile. A step opens the tracker filtered to it. The fullest step is
 * tinted and named in the line above, so the eye goes to the bottleneck.
 */
export function SalesFlow() {
  const { t } = useTranslation("home");
  const query = useTrackerFlow();
  const flow = query.data?.data;
  const steps = flow?.steps ?? [];
  const most = Math.max(0, ...steps.map((step) => step.count));
  const bottleneck = steps.find((step) => most > 0 && step.count === most);

  return (
    <SectionCard
      title={t("flow.title")}
      description={
        flow
          ? t("flow.summary", {
              count: flow.openOrders,
              step: bottleneck ? t(`flow.steps.${bottleneck.id}`) : "",
            })
          : undefined
      }
      className="h-full"
    >
      <QueryBoundary query={query}>
        <ScrollRegion
          label={t("flow.steps.label")}
          className="rounded-none border-0 bg-transparent"
        >
          <ol className="flex min-w-[46rem] items-stretch">
            {steps.map((step, index) => (
              <Fragment key={step.id}>
                {index > 0 ? (
                  <li
                    aria-hidden="true"
                    role="presentation"
                    className="flex shrink-0 items-center"
                  >
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </li>
                ) : null}
                <li className="min-w-0 flex-1">
                  <Link
                    to={`/order-tracker?status=${step.statuses.join(",")}`}
                    className={cn(
                      "flex h-full flex-col gap-0.5 rounded-lg px-2 py-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                      step.id === bottleneck?.id &&
                        "bg-accent text-accent-foreground hover:bg-accent",
                    )}
                  >
                    <span
                      data-numeric
                      className="text-xl font-semibold tracking-tight tabular-nums"
                    >
                      {step.count}
                    </span>
                    <span className="text-xs leading-tight">
                      {t(`flow.steps.${step.id}`)}
                    </span>
                  </Link>
                </li>
              </Fragment>
            ))}
          </ol>
        </ScrollRegion>
      </QueryBoundary>
    </SectionCard>
  );
}
