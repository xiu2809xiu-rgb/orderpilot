import type { Session } from "@orderpilot/shared";
import { panelMenu } from "@/app/shell/panelMenu";
import type { AppAction } from "@/lib/actions";

const pathOf = (to: string): string => to.split("?")[0] ?? "/";

/**
 * Where a quick action leads. An action declares only what it runs, never its
 * address, and every quick action just navigates, so running it with a
 * recording `navigate` is the one way to read the address without a second
 * list that could drift from the action.
 */
export function destinationOf(action: AppAction): string | null {
  const seen: { to: string | null } = { to: null };
  void action.run({
    navigate: (target) => {
      seen.to = target;
    },
  });
  return seen.to;
}

/**
 * True when the side panel already holds the place a quick action opens: a
 * row with its address, or one the address lies under (the reminders are a
 * page of My tasks, an overdue filter is a view of it). The panel keeps a row
 * current on such pages by the same rule, so a shortcut to them says nothing
 * the panel does not.
 */
export function repeatsPanel(session: Session | null, action: AppAction) {
  const to = destinationOf(action);
  if (to === null) return false;
  const path = pathOf(to);
  return panelMenu(session).some((group) =>
    group.rows.some((row) =>
      row.covers.some((entry) => {
        const at = pathOf(entry.to);
        return path === at || path.startsWith(`${at}/`);
      }),
    ),
  );
}
