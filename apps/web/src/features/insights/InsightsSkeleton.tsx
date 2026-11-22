import { useTranslation } from "react-i18next";
import { SectionCardSkeleton } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";

/** The page's own shape while the measures load: five tiles, then the chart card. */
export function InsightsSkeleton() {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="contents">
      <span className="sr-only">{t("states.loading")}</span>
      <div
        aria-hidden="true"
        className="dx-grid-gap grid sm:grid-cols-2 xl:grid-cols-3"
      >
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-48 animate-none rounded-xl" />
        ))}
      </div>
      <SectionCardSkeleton lines={4} />
    </div>
  );
}
