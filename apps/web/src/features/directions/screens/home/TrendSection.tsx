import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// The insights area's chart, as a chunk of its own, so the chart library
// is fetched for the one role that shows it and never joins the home page.
const KpiTrends = lazy(() => import("@/features/insights/KpiTrends"));

/** The twelve-week trend of each measure, under the five measures. */
export function TrendSection() {
  return (
    <Suspense fallback={<Skeleton className="h-64" aria-hidden="true" />}>
      <KpiTrends />
    </Suspense>
  );
}
