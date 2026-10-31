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

/** The tiles on a role's home page, for the areas that role may open. */
export function cuesFor(role: Role, visible: readonly Feature[]): RoleCue[] {
  return visible.flatMap((feature) =>
    feature.cues
      .filter((cue) => cue.roles.includes(role))
      .map((cue) => ({ feature, cue })),
  );
}

export const featureNamespaces: string[] = features.map(
  (feature) => feature.namespace,
);
