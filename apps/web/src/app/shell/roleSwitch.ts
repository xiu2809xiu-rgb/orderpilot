import type { QueryClient } from "@tanstack/react-query";

/**
 * After a sign-in as another role, nothing the old role was shown may stay on
 * screen. Emptying the cache alone does not do that: a list that is on screen
 * keeps the query it already holds, so switching role on Home left the old
 * role's tasks under the new role's name until a reload. So what is on screen
 * is put back to loading and asked for again as the new role, and what is only
 * cached is dropped. A request sent as the old role may still be on its way:
 * it is stopped first, so its answer cannot arrive afterwards.
 */
export async function startAsNewRole(client: QueryClient): Promise<void> {
  await client.cancelQueries();
  client.removeQueries({ type: "inactive" });
  // Not awaited: the new role's page should open at once, and fill as it loads.
  void client.resetQueries();
}
