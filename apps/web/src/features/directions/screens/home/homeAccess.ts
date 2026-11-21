import { INBOX_ROLES, type Permission } from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";

/**
 * What stands where "Needs you" is. A role with an inbox lists its tasks; a
 * role without one gets the one list that is its own, chosen by what the role
 * may do and never by its name: whoever manages the settings gets the business
 * rules, whoever reads the audit trail without managing settings gets the
 * latest refused actions, and any other role without an inbox gets the most
 * overdue orders. Whether a role has an inbox is the one fact about the role
 * itself (`INBOX_ROLES`), because a task list is not a permission.
 */
export type HomeBlock = "tasks" | "overdue" | "refused" | "rules";

/** A block that can also be drawn below the main one. */
export type AddedBlock = Extract<HomeBlock, "overdue" | "refused">;

export function homeBlockOf(
  inbox: boolean,
  permissions: readonly Permission[],
): HomeBlock {
  if (inbox) return "tasks";
  if (permissions.includes("settings.manage")) return "rules";
  if (permissions.includes("audit.read")) return "refused";
  return "overdue";
}

/**
 * The block a role gets besides its main one, by permission. Whoever has an
 * inbox and may decide approvals and read the tracker also follows the overdue
 * orders, directly below "Needs you". Whoever shows the business rules and may
 * read the audit trail also sees the refused actions, below the rules and the
 * health of the services. Nothing else gets an added block.
 */
export function addedBlockOf(
  main: HomeBlock,
  permissions: readonly Permission[],
): AddedBlock | null {
  if (
    main === "tasks" &&
    permissions.includes("approvals.decide") &&
    permissions.includes("tracker.read")
  ) {
    return "overdue";
  }
  if (main === "rules" && permissions.includes("audit.read")) return "refused";
  return null;
}

/**
 * What the signed-in role may read on the home screen, from the permissions
 * the session holds. The API refuses the rest, so each part asks only for what
 * it may have, and a part that is not for the role is not drawn at all.
 */
export function useHomeAccess() {
  const session = useSessionStore((state) => state.session);
  const permissions: readonly Permission[] = session?.permissions ?? [];
  const has = (permission: Permission) => permissions.includes(permission);
  const role = session?.user.role;
  const inbox = role === undefined || INBOX_ROLES.some((r) => r === role);
  const block = homeBlockOf(inbox, permissions);
  const extra = addedBlockOf(block, permissions);
  const overdueShown = block === "overdue" || extra === "overdue";
  return {
    role,
    block,
    extra,
    tasks: block === "tasks" && has("tasks.complete"),
    tracker: has("tracker.read"),
    measures: has("insights.read"),
    /** The twelve-week trend goes with the overdue block, for whoever reads the insights. */
    trend: overdueShown && has("insights.read"),
    create: has("orders.create"),
    /**
     * The server runs the checks for whoever manages settings, and that
     * permission is what shows the business rules, so the health stands beside them.
     */
    health: block === "rules",
  };
}
