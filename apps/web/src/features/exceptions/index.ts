import { TriangleAlert } from "lucide-react";
import { lazy } from "react";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";

registerAction({
  id: "exceptions.open",
  label: "quickActions.exceptions",
  icon: TriangleAlert,
  permission: "exceptions.read",
  quick: true,
  keywords: ["mismatch", "problems"],
  run: ({ navigate }) => {
    navigate("/exceptions?state=OPEN");
  },
});

export default defineFeature({
  id: "exceptions",
  namespace: "exceptions",
  path: "exceptions",
  group: "operations",
  icon: TriangleAlert,
  permission: "exceptions.read",
  cues: [
    {
      id: "openExceptions",
      roles: [
        "APPROVER",
        "SUPPORT",
        "WAREHOUSE",
        "FINANCE",
        "LOGISTICS",
        "MANAGEMENT",
        "AUDITOR",
      ],
      to: "/exceptions?state=OPEN",
      api: "/exceptions?state=OPEN",
    },
  ],
  Page: lazy(() => import("./ExceptionsPage")),
});
