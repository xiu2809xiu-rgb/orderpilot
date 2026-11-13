import type { Permission } from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";

/**
 * What the signed-in role may read on the home screen, from the permissions
 * the session holds. The API refuses the rest, so each part asks only for what
 * it may have and says plainly when it is not for this role. A role with
 * `tasks.complete` has an inbox of its own; Management reads the order flow
 * and the measures but has no tasks to list.
 */
export function useHomeAccess() {
  const permissions = useSessionStore((state) => state.session?.permissions);
  const has = (permission: Permission) =>
    permissions?.includes(permission) ?? false;
  return {
    tasks: has("tasks.complete"),
    tracker: has("tracker.read"),
    measures: has("insights.read"),
    create: has("orders.create"),
  };
}
