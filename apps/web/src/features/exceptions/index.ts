import { TriangleAlert } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "exceptions",
  namespace: "exceptions",
  path: "exceptions",
  group: "operations",
  icon: TriangleAlert,
  permission: "orders.read",
  cues: [{ id: "open", roles: ["APPROVER", "SUPPORT", "MANAGEMENT"] }],
  Page: lazy(() => import("./ExceptionsPage")),
});
