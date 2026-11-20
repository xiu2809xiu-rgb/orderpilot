import { Suspense, lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { redirect } from "react-router";
import type { LoaderFunctionArgs, RouteObject } from "react-router";
import { Splash } from "@/app/Splash";
import {
  canonicalOrderNo,
  isOrderNo,
} from "@/features/directions/screens/order/orderNumber";
import type { RecordHandle } from "@/lib/records";

const NewOrderPage = lazy(() => import("./NewOrderPage"));
const OrderRoute = lazy(() => import("./OrderRoute"));

function element(Page: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<Splash />}>
      <Page />
    </Suspense>
  );
}

/**
 * An order number typed in lower case is the same order. Redirecting before the
 * page renders keeps the strip of open records to one tab per order: a
 * lower-case address would otherwise become a tab of its own for a moment.
 */
export function canonicalOrderAddress({ params, request }: LoaderFunctionArgs) {
  const typed = params.orderNo ?? "";
  const canonical = canonicalOrderNo(typed);
  if (canonical === typed || !isOrderNo(canonical)) return null;
  // The router hands a loader the address without its hash, so only the query is kept.
  const { search } = new URL(request.url);
  return redirect(`/orders/${canonical}${search}`);
}

/**
 * The pages below /orders. An order's page carries the record handle that an
 * item's or a customer's page has, so it opens as a tab named by its number
 * and joins "Opened lately" in the search palette. The tab is the page's path,
 * so one order is one tab, whatever the query says.
 */
export const orderRoutes: RouteObject[] = [
  {
    path: "new",
    handle: { crumb: "orders:newCrumb" },
    element: element(NewOrderPage),
  },
  {
    path: ":orderNo",
    loader: canonicalOrderAddress,
    handle: {
      record: { kind: "order", param: "orderNo" },
    } satisfies RecordHandle,
    element: element(OrderRoute),
  },
];
