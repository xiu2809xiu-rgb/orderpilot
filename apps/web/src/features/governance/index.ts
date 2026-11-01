import { ShieldCheck, Users } from "lucide-react";
import { lazy } from "react";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";

registerAction({
  id: "governance.users",
  label: "quickActions.users",
  icon: Users,
  permission: "users.read",
  quick: true,
  keywords: ["people", "accounts"],
  run: ({ navigate }) => {
    navigate("/governance?tab=users");
  },
});
registerAction({
  id: "governance.matrix",
  label: "quickActions.matrix",
  icon: ShieldCheck,
  permission: "roles.read",
  quick: true,
  keywords: ["roles", "access"],
  run: ({ navigate }) => {
    navigate("/governance?tab=matrix");
  },
});

export default defineFeature({
  id: "governance",
  namespace: "governance",
  path: "governance",
  group: "control",
  icon: ShieldCheck,
  permission: "roles.read",
  cues: [
    {
      id: "roles",
      roles: ["SYSTEM_ADMIN", "AUDITOR"],
      to: "/governance?tab=matrix",
      api: "/governance/matrix",
    },
    {
      id: "activeUsers",
      roles: ["SYSTEM_ADMIN"],
      to: "/governance?tab=users&active=true",
      api: "/users?active=true",
      permission: "users.read",
    },
  ],
  Page: lazy(() => import("./GovernancePage")),
});
