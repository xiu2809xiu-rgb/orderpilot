import { Truck } from "lucide-react";
import { lazy, Suspense } from "react";
import { Splash } from "@/app/Splash";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";

registerAction({
  id: "tracker.open",
  label: "quickActions.tracker",
  icon: Truck,
  permission: "tracker.read",
  quick: true,
  keywords: ["orders", "status"],
  run: ({ navigate }) => {
    navigate("/order-tracker");
  },
});

// The tracker's filters use the sample data's status codes, never area 2's
// state machine: area 2's API replaces them along with the mock reader.
const READY_TO_PICK = "sample-ready-to-pick";

const OrderDetailPage = lazy(() => import("./OrderDetailPage"));

export default defineFeature({
  id: "order-tracker",
  namespace: "order-tracker",
  path: "order-tracker",
  group: "operations",
  icon: Truck,
  permission: "tracker.read",
  cues: [
    {
      id: "openOrders",
      roles: ["PRODUCT_MANAGER", "APPROVER", "SUPPORT", "MANAGEMENT"],
      to: "/order-tracker?open=true",
      api: "/tracker/orders?open=true",
    },
    {
      id: "overdue",
      roles: ["MANAGEMENT"],
      to: "/order-tracker?overdue=true",
      api: "/tracker/orders?overdue=true",
    },
    {
      id: "waitingForApproval",
      roles: ["PRODUCT_MANAGER"],
      to: "/order-tracker?status=sample-pending-approval",
      api: "/tracker/orders?status=sample-pending-approval",
    },
    {
      id: "documentsToConfirm",
      roles: ["SUPPORT"],
      to: "/order-tracker?documentToConfirm=true",
      api: "/tracker/orders?documentToConfirm=true",
    },
    {
      id: "readyToPick",
      roles: ["WAREHOUSE", "LOGISTICS", "MANAGEMENT"],
      to: `/order-tracker?status=${READY_TO_PICK}`,
      api: `/tracker/orders?status=${READY_TO_PICK}`,
    },
  ],
  Page: lazy(() => import("./OrderTrackerPage")),
  // The order's own page shares the feature's guard.
  children: [
    {
      path: ":orderNo",
      handle: { record: { kind: "order", param: "orderNo" } },
      element: (
        <Suspense fallback={<Splash />}>
          <OrderDetailPage />
        </Suspense>
      ),
    },
  ],
});
