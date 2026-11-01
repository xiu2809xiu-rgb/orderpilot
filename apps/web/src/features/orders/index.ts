import { Package } from "lucide-react";
import { defineFeature, devOnlyPage } from "../define";

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
      icon: Package,
    },
  ],
  cues: [],
  planned: true,
  Page: devOnlyPage(
    import.meta.env.DEV ? () => import("./OrdersPage") : undefined,
  ),
});
