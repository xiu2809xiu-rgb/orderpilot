import { Activity } from "lucide-react";
import { lazy } from "react";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";

registerAction({
  id: "monitoring.ai",
  label: "quickActions.aiUse",
  icon: Activity,
  permission: "aiUsage.read",
  quick: true,
  keywords: ["cost", "usage"],
  // Monitoring opens on Observability, so AI use names its tab.
  run: ({ navigate }) => {
    navigate("/monitoring?tab=aiUsage");
  },
});

export default defineFeature({
  id: "monitoring",
  namespace: "monitoring",
  path: "monitoring",
  permission: "aiUsage.read",
  menu: [
    {
      id: "monitoring.monitoring",
      module: "system",
      label: "monitoring:menu.monitoring",
      to: "/monitoring",
      icon: Activity,
    },
  ],
  cues: [
    {
      id: "aiUse",
      roles: ["SYSTEM_ADMIN"],
      to: "/monitoring?tab=aiUsage",
      api: "/monitoring/ai-usage",
    },
  ],
  Page: lazy(() => import("./MonitoringPage")),
});
