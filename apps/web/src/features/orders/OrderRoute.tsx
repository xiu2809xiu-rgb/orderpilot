import { lazy } from "react";
import { useParams } from "react-router";
import { usePageCrumb } from "@/app/shell/pageCrumb";
import { OrderPage } from "@/features/directions/screens/order/OrderPage";
import { OrderSkeleton } from "@/features/directions/screens/order/OrderSkeleton";
import { useOrdersOne } from "@/lib/api/generated/endpoints/orders/orders";
import { hasPermission, useSessionStore } from "@/stores/session";

// The form and its grid are needed only while an order is still being entered.
const DraftOrderPage = lazy(() => import("./DraftOrderPage"));

/**
 * One order, at /orders/:orderNo. A draft is still being entered, so a role
 * that may edit it gets the order form. Every other order, and every role that
 * may only read, gets the order page: its facts, journey, lines, documents,
 * checks and activity. Either way the trail in the top bar ends with the
 * order's number.
 */
export default function OrderRoute() {
  const { orderNo = "" } = useParams();
  usePageCrumb(orderNo);
  const mayEdit = hasPermission(
    useSessionStore((state) => state.session),
    "orders.edit",
  );
  // The order page reads the same order, so this request is made once.
  const order = useOrdersOne(orderNo);
  if (order.isPending) return <OrderSkeleton />;
  if (mayEdit && order.data?.data.captureState === "draft") {
    return <DraftOrderPage />;
  }
  return <OrderPage key={orderNo} orderNo={orderNo} />;
}
