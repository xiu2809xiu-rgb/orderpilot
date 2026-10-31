import { Package } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "orders",
  namespace: "orders",
  path: "orders",
  group: "operations",
  icon: Package,
  permission: "orders.read",
  cues: [
    { id: "open", roles: ["PRODUCT_MANAGER", "SUPPORT", "MANAGEMENT"] },
    { id: "readyToShip", roles: ["WAREHOUSE", "LOGISTICS"] },
  ],
  Page: lazy(() => import("./OrdersPage")),
});
