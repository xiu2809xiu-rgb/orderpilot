import { ClipboardList } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";
import { orderRoutes } from "./routes";

export default defineFeature({
  id: "orders",
  namespace: "orders",
  path: "orders",
  permission: "orders.read",
  menu: [
    {
      id: "orders.orders",
      module: "sales",
      label: "orders:menu.orders",
      to: "/orders",
      icon: ClipboardList,
    },
  ],
  cues: [],
  Page: lazy(() => import("./OrdersPage")),
  children: orderRoutes,
});
