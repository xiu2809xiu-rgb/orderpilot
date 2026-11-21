import { lazy } from "react";
import { Navigate, useLocation, useParams } from "react-router";
import { usePageCrumb } from "@/app/shell/pageCrumb";
import { OrderNotFound } from "@/features/directions/screens/order/OrderNotFound";
import {
  canonicalOrderNo,
  isOrderNo,
} from "@/features/directions/screens/order/orderNumber";
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
 * order's number. The number is read in capitals, so `so-0082` opens SO-0082,
 * and an address that cannot be an order number is "not found" without asking
 * the API, which would only answer with a validation error and a pointless retry.
 */
export default function OrderRoute() {
  const { orderNo: typed = "" } = useParams();
  const { search, hash } = useLocation();
  const orderNo = canonicalOrderNo(typed);
  const valid = isOrderNo(orderNo);
  usePageCrumb(orderNo);
  const mayEdit = hasPermission(
    useSessionStore((state) => state.session),
    "orders.edit",
  );
  // The order page reads the same order, so this request is made once.
  const order = useOrdersOne(orderNo, { query: { enabled: valid } });
  // The router redirects before this renders; this covers a page rendered without it.
  if (valid && orderNo !== typed) {
    return <Navigate replace to={`/orders/${orderNo}${search}${hash}`} />;
  }
  if (!valid) return <OrderNotFound orderNo={typed} />;
  if (order.isPending) return <OrderSkeleton />;
  if (mayEdit && order.data?.data.captureState === "draft") {
    return <DraftOrderPage />;
  }
  return <OrderPage key={orderNo} orderNo={orderNo} />;
}
