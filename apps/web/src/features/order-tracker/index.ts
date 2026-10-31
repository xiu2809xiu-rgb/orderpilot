import { Truck } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "order-tracker",
  namespace: "order-tracker",
  path: "order-tracker",
  group: "operations",
  icon: Truck,
  permission: "orders.read",
  cues: [{ id: "inTransit", roles: ["LOGISTICS", "MANAGEMENT"] }],
  Page: lazy(() => import("./OrderTrackerPage")),
});
