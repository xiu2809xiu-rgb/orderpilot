import { Suspense, lazy } from "react";
import type { RouteObject } from "react-router";
import { Splash } from "@/app/Splash";

const RemindersPage = lazy(() => import("./RemindersPage"));
const OrderStepsPage = lazy(() => import("./OrderStepsPage"));
const SprApprovalPage = lazy(() => import("./SprApprovalPage"));

function page(
  path: string,
  Page: React.LazyExoticComponent<React.ComponentType>,
  crumb: string,
): RouteObject {
  return {
    path,
    element: (
      <Suspense fallback={<Splash />}>
        <Page />
      </Suspense>
    ),
    handle: { crumb },
  };
}

/** The pages below /workflows. The inbox is the feature's own index page. */
export const workflowRoutes: RouteObject[] = [
  page("reminders", RemindersPage, "workflows:nav.reminders"),
  page("orders/:orderNo", OrderStepsPage, "workflows:order.stepsHeading"),
  page("sprs/:recordNo", SprApprovalPage, "workflows:spr.summaryHeading"),
];
