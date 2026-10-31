import { ChartColumn } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "insights",
  namespace: "insights",
  path: "insights",
  group: "insight",
  icon: ChartColumn,
  permission: "orders.read",
  cues: [{ id: "kpis", roles: ["MANAGEMENT"] }],
  Page: lazy(() => import("./InsightsPage")),
});
