import { Suspense, lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { RouteObject } from "react-router";
import { Splash } from "@/app/Splash";

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
 * The pages below /orders. They carry no record handle yet: how a stored order
 * opens as a tab, and where its read-only view lives, is the next story's call.
 */
export const orderRoutes: RouteObject[] = [
  {
    path: "new",
    handle: { crumb: "orders:newCrumb" },
    element: element(NewOrderPage),
  },
  { path: ":orderNo", element: element(OrderRoute) },
];
