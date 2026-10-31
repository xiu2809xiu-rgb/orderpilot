import { Truck } from "lucide-react";
import { lazy, Suspense } from "react";
import { Splash } from "@/app/Splash";
import { defineFeature } from "../define";

const OrderDetailPage = lazy(() => import("./OrderDetailPage"));

export default defineFeature({
  id: "order-tracker",
  namespace: "order-tracker",
  path: "order-tracker",
  group: "operations",
  icon: Truck,
  permission: "tracker.read",
  cues: [{ id: "inTransit", roles: ["LOGISTICS", "MANAGEMENT"] }],
  Page: lazy(() => import("./OrderTrackerPage")),
  // The order's own page shares the feature's guard.
  children: [
    {
      path: ":orderNo",
      element: (
        <Suspense fallback={<Splash />}>
          <OrderDetailPage />
        </Suspense>
      ),
    },
  ],
});
