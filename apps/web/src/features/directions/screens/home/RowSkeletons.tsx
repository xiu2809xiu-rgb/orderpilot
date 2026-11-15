import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The shape of a list of rows while it loads: a title and a line, and the
 * button. It is announced once as loading, and its blocks are hidden.
 */
export function RowSkeletons({ rows = 4 }: { rows?: number }) {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">{t("states.loading")}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4" aria-hidden="true">
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}
