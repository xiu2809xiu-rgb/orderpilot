import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The upload screen's own shape while its chunk loads: the head, the info line
 * and the drop zone. It is announced once as loading, and its blocks are hidden.
 */
export function UploadSkeleton() {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="dx-sheet dx-page">
      <span className="sr-only">{t("states.loading")}</span>
      <div className="dx-skel-head flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-5 w-full max-w-prose" aria-hidden="true" />
      <Skeleton className="h-72" aria-hidden="true" />
    </div>
  );
}
