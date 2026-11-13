import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrackerFlow } from "@/lib/api/generated/endpoints/tracker/tracker";
import { PURCHASE_STEP_IDS } from "../../data/estimates";
import { Section } from "../../parts/Section";
import { FlowRow, type FlowCell } from "./FlowRow";
import { useHomeAccess } from "./homeAccess";
import { ordersHref } from "./homeLinks";

/**
 * The two flows with the orders at each step. The sales flow reads the
 * tracker's own count for each of its nine steps, and a step opens the orders
 * list at that step. The tracker has no purchase orders, so that row shows the
 * nine steps without counts and says why, rather than inventing any.
 */
export function Flows() {
  const { t } = useTranslation("directions-home");
  const { t: tParts } = useTranslation("directions-parts");
  const access = useHomeAccess();
  const flow = useTrackerFlow({ query: { enabled: access.tracker } });
  const steps = flow.data?.data.steps ?? [];
  const most = Math.max(0, ...steps.map((step) => step.count));
  const busiest = steps.find((step) => most > 0 && step.count === most);
  const labels = {
    completed: t("flows.step.other"),
    active: t("flows.step.busiest"),
    inactive: t("flows.step.other"),
  };

  const sales: FlowCell[] = steps.map((step) => {
    const title = tParts(`journey.sales.${step.id}`);
    return {
      id: step.id,
      title,
      count: step.count,
      href: ordersHref(step.id, step.statuses),
      linkLabel: t("flows.opens", { step: title, count: step.count }),
      busiest: step.id === busiest?.id,
      note: t("flows.orders", { count: step.count }),
    };
  });
  const purchase: FlowCell[] = PURCHASE_STEP_IDS.map((id, index) => ({
    id,
    title: tParts(`journey.purchase.${id}`),
    count: null,
    href: null,
    busiest: false,
    note: t("flows.stepNo", { n: index + 1 }),
  }));

  return (
    <Section
      title={t("flows.title")}
      intro={
        flow.data
          ? t("flows.summary", {
              count: flow.data.data.openOrders,
              step: busiest ? tParts(`journey.sales.${busiest.id}`) : "",
            })
          : undefined
      }
      work
    >
      {!access.tracker ? (
        <p className="fs-14 flex max-w-prose items-start gap-2 text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t("flows.noAccess")}
        </p>
      ) : flow.isError ? (
        <p role="alert" className="fs-14 text-destructive">
          {t("flows.failed")}
        </p>
      ) : flow.isPending ? (
        <Skeleton className="h-28" aria-hidden="true" />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="fs-14 font-semibold">{t("flows.sales")}</h3>
            <FlowRow
              label={tParts("journey.flows.sales")}
              labels={labels}
              cells={sales}
            />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="fs-14 font-semibold">{t("flows.purchase")}</h3>
            <FlowRow
              label={tParts("journey.flows.purchase")}
              labels={labels}
              cells={purchase}
            />
            <p className="fs-14 text-muted-foreground">
              {t("flows.purchaseNote")}
            </p>
          </div>
        </div>
      )}
    </Section>
  );
}
