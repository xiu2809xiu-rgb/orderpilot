import type { Session } from "@orderpilot/shared";
import { hasPermission } from "@/stores/session";

export type ControlRowId = "people" | "roles" | "audit" | "monitoring";

export interface ControlRow {
  id: ControlRowId;
  to: string;
  /** Every one of these is needed: the page's own permission and the tab's. */
  needs: readonly string[];
}

/**
 * The pages for running and checking OrderPilot. A row shows only where the
 * role may open the page, with the same checks as the menu: the People tab
 * lives on the governance page, which needs `roles.read` as well.
 */
export const CONTROL_ROWS: readonly ControlRow[] = [
  {
    id: "people",
    to: "/governance?tab=users",
    needs: ["users.read", "roles.read"],
  },
  { id: "roles", to: "/governance?tab=matrix", needs: ["roles.read"] },
  { id: "audit", to: "/audit", needs: ["audit.read"] },
  { id: "monitoring", to: "/monitoring", needs: ["aiUsage.read"] },
];

export function visibleControlRows(session: Session | null): ControlRow[] {
  return CONTROL_ROWS.filter((row) =>
    row.needs.every((permission) => hasPermission(session, permission)),
  );
}
