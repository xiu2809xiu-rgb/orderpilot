import { ClipboardList, FilePlus } from "lucide-react";
import { lazy } from "react";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";
import { orderRoutes } from "./routes";

// Ctrl+K and the home page offer it to the roles that may start an order.
registerAction({
  id: "orders.new",
  label: "quickActions.newOrder",
  icon: FilePlus,
  permission: "orders.create",
  quick: true,
  keywords: ["order", "po", "customer", "enter"],
  run: ({ navigate }) => {
    navigate("/orders/new");
  },
});

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
