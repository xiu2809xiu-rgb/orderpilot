import type { Permission } from "@orderpilot/shared";

/**
 * What a person was trying to do, by the permission they lacked. A refusal's
 * summary is read by the auditor on the home page and in the audit trail, so
 * it says this in words. The method and path stay in the event's entity id.
 */
const ATTEMPT: Readonly<Record<Permission, string>> = {
  "users.read": "viewing the users",
  "users.manage": "changing a user",
  "roles.read": "viewing the roles",
  "roles.manage": "changing the roles",
  "settings.manage": "changing the settings",
  "audit.read": "reading the audit trail",
  "aiUsage.read": "viewing the AI use",
  "documents.read": "viewing a document",
  "documents.upload": "uploading a document",
  "orders.read": "viewing an order",
  "orders.create": "creating an order",
  "orders.edit": "changing a draft order",
  "tracker.read": "viewing the tracker",
  "exceptions.read": "viewing the exceptions",
  "insights.read": "viewing the KPIs",
  "approvals.decide": "deciding on an approval",
  "payments.confirm": "recording a payment",
  "payments.post": "posting a payment",
  "workflows.read": "viewing the workflows",
  "spr.read": "viewing an SPR",
  "workflows.inboxes.any": "viewing another role's inbox",
  "tasks.complete": "acting on a task",
  "masking.customerNote": "seeing the sample customer note",
  "spark.use": "asking Spark",
};

/** "Sophia Chen was refused acting on a task". */
export function refusalSummary(
  displayName: string,
  permission: Permission | undefined,
): string {
  const attempt = permission
    ? ATTEMPT[permission]
    : "a request no access rule covers";
  return `${displayName} was refused ${attempt}`;
}
