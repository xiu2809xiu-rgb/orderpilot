import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// The insights area's chart, as a chunk of its own, so the chart library
// is fetched for the one role that shows it and never joins the home page.
const KpiTrends = lazy(() => import("@/features/insights/KpiTrends"));

// The block's "View all KPIs" link belongs to the insights area and is a 20 px line of text;
// on a coarse pointer the link inside gets a 44 px box, without touching that file.
export const REACH =
  "[&_a]:pointer-coarse:inline-flex [&_a]:pointer-coarse:min-h-11 [&_a]:pointer-coarse:items-center";

/** The twelve-week trend of each measure, under the five measures. */
export function TrendSection() {
  return (
    <Suspense fallback={<Skeleton className="h-64" aria-hidden="true" />}>
      <div className={REACH}>
        <KpiTrends />
      </div>
    </Suspense>
  );
}
