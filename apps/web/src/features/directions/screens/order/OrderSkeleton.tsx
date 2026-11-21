import { Skeleton } from "@/components/ui/skeleton";
import "../orders/orders.css";

/** The order page's own shape while it loads: the title, the facts, the journey and the tabs. */
export function OrderSkeleton() {
  return (
    <div className="dx-sheet flex flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-20" />
      <Skeleton className="h-64" />
      <Skeleton className="h-72" />
    </div>
  );
}
