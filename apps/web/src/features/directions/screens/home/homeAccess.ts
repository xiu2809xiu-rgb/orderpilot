import { INBOX_ROLES, type Permission, type Role } from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";

/**
 * What stands where "Needs you" is. A role with an inbox lists its tasks; the
 * three without one (Management, the auditor, the system administrator) get
 * the one list that is theirs. Chosen by role, as the old home did, because it
 * is the role's job that decides what needs it, not a single permission.
 */
export type HomeBlock = "tasks" | "overdue" | "refused" | "rules";

export function homeBlockOf(role: Role): HomeBlock {
  if (INBOX_ROLES.some((inbox) => inbox === role)) return "tasks";
  if (role === "MANAGEMENT") return "overdue";
  if (role === "AUDITOR") return "refused";
  return "rules";
}

/**
 * What the signed-in role may read on the home screen, from the permissions
 * the session holds. The API refuses the rest, so each part asks only for what
 * it may have, and a part that is not for the role is not drawn at all.
 */
export function useHomeAccess() {
  const session = useSessionStore((state) => state.session);
  const permissions = session?.permissions;
  const has = (permission: Permission) =>
    permissions?.includes(permission) ?? false;
  const role = session?.user.role;
  const block = role ? homeBlockOf(role) : "tasks";
  return {
    role,
    block,
    tasks: block === "tasks" && has("tasks.complete"),
    tracker: has("tracker.read"),
    measures: has("insights.read"),
    create: has("orders.create"),
    /** Only the administrator runs the checks: the server refuses any other role. */
    health: role === "SYSTEM_ADMIN" && has("settings.manage"),
  };
}
