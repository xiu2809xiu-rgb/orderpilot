import type { Role, Session } from "@orderpilot/shared";
import { Home } from "lucide-react";
import { hasPermission } from "@/stores/session";
import type { Feature, FeatureCue, MenuEntry, ModuleId } from "./define";
import { MODULES } from "./define";
import { features } from "./registry";

/** The features this session may open. The server still decides on every call. */
export function featuresFor(
  session: Session | null,
  list: readonly Feature[] = features,
): Feature[] {
  return list.filter((feature) => hasPermission(session, feature.permission));
}

/** Home belongs to the shell, not to a feature, so it is declared here. */
export const HOME_ENTRY: MenuEntry = {
  id: "home",
  module: "home",
  label: "common:nav.home",
  to: "/",
  icon: Home,
};

/**
 * The menu for this session, in module order and then registry order. An entry
 * needs its feature's permission and its own, so no link lands on a refusal.
 */
export function menuFor(
  session: Session | null,
  list: readonly Feature[] = features,
): MenuEntry[] {
  if (!session) return [];
  const entries = [
    HOME_ENTRY,
    ...featuresFor(session, list).flatMap((feature) =>
      feature.menu.filter((entry) => hasPermission(session, entry.permission)),
    ),
  ];
  return MODULES.flatMap((module) =>
    entries.filter((entry) => entry.module === module),
  );
}

/** The menu split by module. A module with no entry for this role is dropped. */
export function groupedMenu(
  entries: readonly MenuEntry[],
): { module: ModuleId; entries: MenuEntry[] }[] {
  return MODULES.map((module) => ({
    module,
    entries: entries.filter((entry) => entry.module === module),
  })).filter((group) => group.entries.length > 0);
}

/**
 * Whether an entry is the page a person is on. A `?tab=` makes two entries of
 * one page tell apart; the entry flagged as the default owns an address with
 * no tab. Other filters in the address are ignored on purpose.
 */
export function isEntryActive(
  entry: MenuEntry,
  where: { pathname: string; search: string },
): boolean {
  const [path = "/", query = ""] = entry.to.split("?");
  const here = where.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return here === "/";
  if (here !== path && !here.startsWith(`${path}/`)) return false;
  const tab = new URLSearchParams(query).get("tab");
  if (tab === null) return true;
  const current = new URLSearchParams(where.search).get("tab");
  return current === tab || (current === null && entry.isDefaultTab === true);
}

export interface RoleCue {
  feature: Feature;
  cue: FeatureCue;
}

/** The order of each role's tiles. A role only gets those it may open. */
export const TILE_ORDER: Readonly<Record<Role, readonly string[]>> = {
  PRODUCT_MANAGER: ["myTasks", "waitingForApproval", "openOrders", "overdue"],
  APPROVER: ["awaitingApproval", "overdue", "openOrders", "openExceptions"],
  SUPPORT: [
    "myTasks",
    "documentsToConfirm",
    "openOrders",
    "overdue",
    "openExceptions",
  ],
  WAREHOUSE: ["myTasks", "readyToPick", "overdue", "openExceptions"],
  FINANCE: ["myTasks", "awaitingPayment", "overdue", "openExceptions"],
  LOGISTICS: ["myTasks", "readyToPick", "overdue", "openExceptions"],
  MANAGEMENT: [
    "openOrders",
    "overdue",
    "awaitingApproval",
    "awaitingPayment",
    "readyToPick",
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
