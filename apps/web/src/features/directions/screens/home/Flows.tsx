import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { useTrackerFlow } from "@/lib/api/generated/endpoints/tracker/tracker";
import { PURCHASE_STEP_IDS } from "../../data/estimates";
import { showPlannedFeatures } from "@/features/registry";
import { HomeSection } from "./HomeSection";
import { FlowRow, type FlowCell } from "./FlowRow";
import { HomeQuery } from "./HomeQuery";
import { useHomeAccess } from "./homeAccess";
import { useOrderLinks } from "./homeLinks";

/**
 * The two flows with the orders at each step. The sales flow reads the
 * tracker's own count for each of its nine steps, and a step opens the orders
 * list at that step. The tracker has no purchase orders (Phase 2), so a
 * production build draws no purchase row at all, as the old home did; a
 * developer who turns planned features on sees its nine steps without counts
 * and the reason, rather than invented ones. A role that may not read the
 * tracker has no such section at all.
 */
export function Flows() {
  const { t } = useTranslation("directions-home");
  const { t: tParts } = useTranslation("directions-parts");
  const access = useHomeAccess();
  const links = useOrderLinks();
  const flow = useTrackerFlow({ query: { enabled: access.tracker } });
  if (!access.tracker) return null;
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
      href: links.step(step.id, step.statuses),
      busiest: step.id === busiest?.id,
      note: t("flows.orders", { count: step.count }),
    };
  });
  const withPurchase = showPlannedFeatures();
  const purchase: FlowCell[] = PURCHASE_STEP_IDS.map((id, index) => ({
    id,
    title: tParts(`journey.purchase.${id}`),
    count: null,
    href: null,
    busiest: false,
    note: t("flows.stepNo", { n: index + 1 }),
  }));

  return (
    <HomeSection
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
      <HomeQuery
        query={flow}
        loading={<Skeleton className="h-28" aria-hidden="true" />}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="fs-14 font-semibold">{t("flows.sales")}</h3>
            <FlowRow
              label={tParts("journey.flows.sales")}
              labels={labels}
              cells={sales}
            />
          </div>
          {withPurchase ? (
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
          ) : null}
        </div>
      </HomeQuery>
    </HomeSection>
  );
}
