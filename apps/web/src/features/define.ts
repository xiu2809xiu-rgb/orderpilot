import type { Permission, Role } from "@orderpilot/shared";
import type { LucideIcon } from "lucide-react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { RouteObject } from "react-router";

export const NAV_GROUPS = ["operations", "data", "insight", "control"] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/**
 * A tile on a role's home page. Its label is `cues.<id>` in the feature's
 * namespace. Until the area has data the tile shows a dash and "Planned".
 */
export interface FeatureCue {
  id: string;
  roles: readonly Role[];
}

/**
 * What an area gives the shell: a route, a menu entry, tiles for role home
 * pages, and a text namespace (`locales/en/<namespace>.json`, loaded on
 * demand). The page is its own chunk.
 */
export interface Feature {
  id: string;
  namespace: string;
  /** The first URL segment, such as "orders" for /orders. */
  path: string;
  group: NavGroup;
  icon: LucideIcon;
  /** The permission that shows the menu entry and opens the route. */
  permission?: Permission;
  cues: readonly FeatureCue[];
  Page: LazyExoticComponent<ComponentType>;
  /** Routes below the feature, such as `:id`. They share its guard. */
  children?: RouteObject[];
}

export function defineFeature(feature: Feature): Feature {
  return feature;
}
