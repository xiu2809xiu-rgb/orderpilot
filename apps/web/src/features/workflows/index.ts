import { BellRing, Clock, Inbox, Workflow } from "lucide-react";
import { lazy } from "react";
import { registerAction } from "@/lib/actions";
import { defineFeature } from "../define";
import { workflowRoutes } from "./routes";

registerAction({
  id: "workflows.inbox",
  label: "quickActions.inbox",
  icon: Inbox,
  permission: "tasks.complete",
  quick: true,
  keywords: ["tasks", "my work"],
  run: ({ navigate }) => {
    navigate("/workflows");
  },
});
registerAction({
  id: "workflows.overdue",
  label: "quickActions.overdue",
  icon: Clock,
  permission: "tasks.complete",
  quick: true,
  keywords: ["late", "tasks"],
  run: ({ navigate }) => {
    navigate("/workflows?overdue=true");
  },
});
registerAction({
  id: "workflows.reminders",
  label: "quickActions.reminders",
  icon: BellRing,
  permission: "tasks.complete",
  quick: true,
  run: ({ navigate }) => {
    navigate("/workflows/reminders");
  },
});

const INBOX_TILE_ROLES = [
  "PRODUCT_MANAGER",
  "SUPPORT",
  "WAREHOUSE",
  "FINANCE",
  "LOGISTICS",
] as const;

export default defineFeature({
  id: "workflows",
  namespace: "workflows",
  path: "workflows",
  group: "operations",
  icon: Workflow,
  permission: "workflows.read",
  cues: [
    {
      id: "myTasks",
      roles: INBOX_TILE_ROLES,
      to: "/workflows",
      api: "/workflows/tasks",
    },
    {
      id: "overdue",
      roles: [...INBOX_TILE_ROLES, "APPROVER"],
      to: "/workflows?overdue=true",
      api: "/workflows/tasks?overdue=true",
    },
    {
      id: "awaitingApproval",
      roles: ["APPROVER"],
      to: "/workflows?kind=APPROVE_SPR",
      api: "/workflows/tasks?kind=APPROVE_SPR",
    },
    {
      id: "awaitingApproval",
      roles: ["MANAGEMENT"],
      to: "/workflows?role=APPROVER&kind=APPROVE_SPR",
      api: "/workflows/inboxes/APPROVER/tasks?kind=APPROVE_SPR",
      permission: "workflows.inboxes.any",
    },
    {
      id: "awaitingPayment",
      roles: ["FINANCE"],
      to: "/workflows?kind=CONFIRM_PAYMENT",
      api: "/workflows/tasks?kind=CONFIRM_PAYMENT",
    },
    {
      id: "awaitingPayment",
      roles: ["MANAGEMENT"],
      to: "/workflows?role=FINANCE&kind=CONFIRM_PAYMENT",
      api: "/workflows/inboxes/FINANCE/tasks?kind=CONFIRM_PAYMENT",
      permission: "workflows.inboxes.any",
    },
  ],
  Page: lazy(() => import("./WorkflowsPage")),
  children: workflowRoutes,
});
