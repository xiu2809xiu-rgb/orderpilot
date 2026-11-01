import type { Role, Session } from "@orderpilot/shared";
import { hasPermission } from "@/stores/session";
import type { Feature, FeatureCue, NavGroup } from "./define";
import { NAV_GROUPS } from "./define";
import { features } from "./registry";

/** The features this session may open. The server still decides on every call. */
export function featuresFor(
  session: Session | null,
  list: readonly Feature[] = features,
): Feature[] {
  return list.filter((feature) => hasPermission(session, feature.permission));
}

export function groupedFeatures(
  visible: readonly Feature[],
): { group: NavGroup; items: Feature[] }[] {
  return NAV_GROUPS.map((group) => ({
    group,
    items: visible.filter((feature) => feature.group === group),
  })).filter((entry) => entry.items.length > 0);
}

export interface RoleCue {
  feature: Feature;
  cue: FeatureCue;
}

/** The order of each role's tiles. A role only gets those it may open. */
export const TILE_ORDER: Readonly<Record<Role, readonly string[]>> = {
  PRODUCT_MANAGER: ["myTasks", "awaitingApproval", "openOrders", "overdue"],
  APPROVER: ["awaitingApproval", "overdue", "openOrders", "openExceptions"],
  SUPPORT: [
    "myTasks",
    "documentsToConfirm",
    "openOrders",
    "overdue",
    "openExceptions",
  ],
  WAREHOUSE: ["myTasks", "readyToShip", "overdue", "openExceptions"],
  FINANCE: ["myTasks", "awaitingPayment", "overdue", "openExceptions"],
  LOGISTICS: ["myTasks", "readyToShip", "overdue", "openExceptions"],
  MANAGEMENT: [
    "openOrders",
    "overdue",
    "awaitingApproval",
    "awaitingPayment",
    "readyToShip",
    "openExceptions",
  ],
  AUDITOR: ["auditEvents", "refusedActions", "roles", "openExceptions"],
  SYSTEM_ADMIN: ["activeUsers", "roles", "auditEvents", "aiUse"],
};

/**
 * The tiles on this session's home page, in the role's order. A tile needs the
 * feature's permission and the list's own, so none lands on a refusal.
 */
export function cuesFor(
  session: Session | null,
  list: readonly Feature[] = features,
): RoleCue[] {
  if (!session) return [];
  const { role } = session.user;
  const order = TILE_ORDER[role];
  return featuresFor(session, list)
    .flatMap((feature) =>
      feature.cues
        .filter(
          (cue) =>
            cue.roles.includes(role) && hasPermission(session, cue.permission),
        )
        .map((cue) => ({ feature, cue })),
    )
    .sort((a, b) => order.indexOf(a.cue.id) - order.indexOf(b.cue.id));
}

export const featureNamespaces: string[] = features.map(
  (feature) => feature.namespace,
);
