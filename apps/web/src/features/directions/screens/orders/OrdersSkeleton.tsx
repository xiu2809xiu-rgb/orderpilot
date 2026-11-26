import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import "./orders.css";

/**
 * The Orders screen's own shape while its chunk loads: the head, the views, the
 * filters and the rows. It is announced once as loading.
 */
export function OrdersSkeleton() {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="od-page flex flex-col gap-6">
      <span className="sr-only">{t("states.loading")}</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-12 w-full max-w-xl" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-52" />
      </div>
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: 10 }, (_, index) => (
          <Skeleton still key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
