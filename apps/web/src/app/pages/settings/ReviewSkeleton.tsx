import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/** Three rows of grey boxes where the review list will be, announced once as loading. */
export function ReviewSkeleton() {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-s4">
      <span className="sr-only">{t("states.loading")}</span>
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex gap-s4" aria-hidden="true">
          <Skeleton className="size-32 shrink-0" />
          <div className="flex flex-1 flex-col gap-s2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
