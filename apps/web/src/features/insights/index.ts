import { ChartColumn } from "lucide-react";
import { lazy } from "react";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";

registerAction({
  id: "insights.kpis",
  label: "quickActions.kpis",
  icon: ChartColumn,
  permission: "insights.read",
  quick: true,
  keywords: ["measures", "numbers"],
  run: ({ navigate }) => {
    navigate("/insights");
  },
});

export default defineFeature({
  id: "insights",
  namespace: "insights",
  path: "insights",
  group: "insight",
  icon: ChartColumn,
  permission: "insights.read",
  cues: [],
  Page: lazy(() => import("./InsightsPage")),
});
