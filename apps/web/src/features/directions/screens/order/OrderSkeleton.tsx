import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import "../orders/orders.css";

/**
 * The order page's own shape while it loads: the title, the facts, the journey
 * and the tabs. It is announced once as loading, and its blocks are hidden.
 */
export function OrderSkeleton() {
  const { t } = useTranslation("components");
  return (
    <div role="status" aria-busy="true" className="dx-sheet dx-page">
      <span className="sr-only">{t("states.loading")}</span>
      <div className="dx-skel-head flex flex-col gap-2" aria-hidden="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-20" aria-hidden="true" />
      <Skeleton className="h-64" aria-hidden="true" />
      <Skeleton className="h-72" aria-hidden="true" />
    </div>
  );
}
