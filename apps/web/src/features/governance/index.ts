import { ShieldCheck } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "governance",
  namespace: "governance",
  path: "governance",
  group: "control",
  icon: ShieldCheck,
  permission: "roles.read",
  cues: [{ id: "roles", roles: ["SYSTEM_ADMIN", "AUDITOR"] }],
  Page: lazy(() => import("./GovernancePage")),
});
