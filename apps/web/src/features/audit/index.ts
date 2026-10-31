import { ScrollText } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "audit",
  namespace: "audit",
  path: "audit",
  group: "control",
  icon: ScrollText,
  permission: "audit.read",
  cues: [{ id: "events", roles: ["SYSTEM_ADMIN", "AUDITOR"] }],
  Page: lazy(() => import("./AuditPage")),
});
