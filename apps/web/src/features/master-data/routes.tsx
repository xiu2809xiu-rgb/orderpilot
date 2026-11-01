import { Suspense, lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { RouteObject } from "react-router";
import { ListPageSkeleton } from "@/components/common";

const ItemsPage = lazy(() => import("./ItemsPage"));
const ItemDetailPage = lazy(() => import("./ItemDetailPage"));
const CustomersPage = lazy(() => import("./CustomersPage"));
const CustomerDetailPage = lazy(() => import("./CustomerDetailPage"));
const VendorsPage = lazy(() => import("./VendorsPage"));
const VendorDetailPage = lazy(() => import("./VendorDetailPage"));

function element(Page: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <Page />
    </Suspense>
  );
}

function section(
  path: string,
  List: LazyExoticComponent<ComponentType>,
  Detail: LazyExoticComponent<ComponentType>,
): RouteObject {
  return {
    path,
    handle: { crumb: `master-data:tabs.${path}` },
    children: [
      { index: true, element: element(List) },
      { path: ":no", element: element(Detail) },
    ],
  };
}

/** The pages below /master-data, which itself opens Items. */
export const masterDataRoutes: RouteObject[] = [
  section("items", ItemsPage, ItemDetailPage),
  section("customers", CustomersPage, CustomerDetailPage),
  section("vendors", VendorsPage, VendorDetailPage),
];
