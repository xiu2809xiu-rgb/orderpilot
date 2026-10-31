import { Workflow } from "lucide-react";
import { lazy } from "react";
import { defineFeature } from "../define";

export default defineFeature({
  id: "workflows",
  namespace: "workflows",
  path: "workflows",
  group: "operations",
  icon: Workflow,
  permission: "orders.read",
  cues: [
    {
      id: "myTasks",
      roles: [
        "PRODUCT_MANAGER",
        "APPROVER",
        "SUPPORT",
        "WAREHOUSE",
        "FINANCE",
        "LOGISTICS",
      ],
    },
    { id: "sprApproval", roles: ["PRODUCT_MANAGER", "APPROVER"] },
    { id: "paymentsToConfirm", roles: ["FINANCE"] },
  ],
  Page: lazy(() => import("./WorkflowsPage")),
});
