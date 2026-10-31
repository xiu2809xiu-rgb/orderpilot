import { Activity } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "monitoring",
  namespace: "monitoring",
  path: "monitoring",
  group: "control",
  icon: Activity,
  permission: "aiUsage.read",
  cues: [{ id: "aiUsage", roles: ["SYSTEM_ADMIN", "MANAGEMENT", "AUDITOR"] }],
  Page: lazy(() => import("./MonitoringPage")),
});
