import { ShieldCheck } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "governance",
  namespace: "governance",
  path: "governance",
  group: "control",
  icon: ShieldCheck,
  permission: "roles.manage",
  cues: [{ id: "roles", roles: ["SYSTEM_ADMIN"] }],
  Page: lazy(() => import("./GovernancePage")),
});
