import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The review's own shape while the demo document loads: the head card, the
 * progress card, then the page on the left and the field list on the right, in
 * the same grid as ReviewStage, so that nothing moves when the review opens.
 * It is announced once as loading, and its blocks are hidden.
 */
export function DemoReviewSkeleton() {
  const { t } = useTranslation("directions-intake");
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t("review.loading")}</span>
      <div aria-hidden="true" className="dx-card flex flex-col gap-2 px-5 py-4">
        <Skeleton className="h-5 w-48 max-w-full" />
        <Skeleton className="h-4 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div
        aria-hidden="true"
        className="dx-card flex items-center gap-4 px-4 py-3"
      >
        <Skeleton className="size-12 shrink-0 rounded-full" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div
        aria-hidden="true"
        className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]"
      >
        <Skeleton className="w-full" style={{ aspectRatio: "910 / 1287" }} />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
