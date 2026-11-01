import { ScrollText } from "lucide-react";
import { lazy } from "react";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";

registerAction({
  id: "audit.trail",
  label: "quickActions.audit",
  icon: ScrollText,
  permission: "audit.read",
  quick: true,
  keywords: ["log", "history"],
  run: ({ navigate }) => {
    navigate("/audit");
  },
});

export default defineFeature({
  id: "audit",
  namespace: "audit",
  path: "audit",
  group: "control",
  icon: ScrollText,
  permission: "audit.read",
  cues: [
    {
      id: "auditEvents",
      roles: ["SYSTEM_ADMIN", "AUDITOR"],
      to: "/audit",
      api: "/audit/events",
    },
    {
      id: "refusedActions",
      roles: ["AUDITOR"],
      to: "/audit?refusals=1",
      api: "/audit/events?refusalsOnly=true",
    },
  ],
  Page: lazy(() => import("./AuditPage")),
});
