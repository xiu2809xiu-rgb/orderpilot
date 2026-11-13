import { ListOrdered } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { screenPath } from "../../directions";
import { useDirection } from "../../frame/useDirection";
import { EmptyState } from "../../parts/EmptyState";
import { OrderSkeleton } from "./OrderSkeleton";

/**
 * The order screen with no order named. The tracker lists the most overdue
 * order first, so the first open one is where the work is. A role that cannot
 * read the tracker, or has no open order, is sent to the list instead of a
 * blank page.
 */
export function OrderPicker() {
  const { t } = useTranslation("directions-orders");
  const direction = useDirection();
  const first = useTrackerList({ open: "true", pageSize: 1 });
  const next = first.data?.data[0];
  if (next) {
    return (
      <Navigate
        to={`${screenPath(direction, "order")}?order=${encodeURIComponent(next.orderNo)}`}
        replace
      />
    );
  }
  if (first.isPending) return <OrderSkeleton />;
  return (
    <div className="dx-sheet py-6">
      <EmptyState
        icon={ListOrdered}
        title={t("order.pickTitle")}
        description={t("order.pickBody")}
        action={
          <Button asChild variant="outline">
            <Link to={screenPath(direction, "orders")}>{t("order.back")}</Link>
          </Button>
        }
      />
    </div>
  );
}
