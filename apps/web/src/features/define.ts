import type { Permission, Role } from "@orderpilot/shared";
import type { LucideIcon } from "lucide-react";
import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { RouteObject } from "react-router";

/**
 * The modules of the menu, in the order a person reads them. A module with no
 * entry for the signed-in role is left out, so nobody sees an empty heading.
 * Its name is `nav.modules.<id>` in the `common` namespace.
 */
export const MODULES = [
  "home",
  "sales",
  "purchasing",
  "warehouse",
  "finance",
  "documents",
  "masterData",
  "reports",
  "system",
] as const;
export type ModuleId = (typeof MODULES)[number];

/** A number beside a menu entry: the total of a list that holds waiting work. */
export interface MenuCount {
  /** The API list after `/api/v1`, with the same filters as the entry's `to`. */
  api: string;
  /** What the list needs, when that is more than the entry needs. */
  permission?: Permission;
}

/**
 * One line of the menu. A feature may give several, and a module may mix
 * entries of several features. Everything a person sees is declared here, so
 * a screen that does not exist has no entry.
 */
export interface MenuEntry {
  /** Unique across the app. */
  id: string;
  module: ModuleId;
  /** `namespace:key`, such as "workflows:menu.myTasks". */
  label: string;
  /** The route, with a `?tab=` when the entry is one tab of a page. */
  to: string;
  icon: LucideIcon;
  /** Needed on top of the feature's own permission to see this entry. */
  permission?: Permission;
  count?: MenuCount;
  /** Set on the tab a page shows when the address names none. */
  isDefaultTab?: boolean;
}

/**
 * A tile on a role's home page. Its label is `tiles.<id>` in the `home`
 * namespace. Plain data, so no feature's code joins the entry bundle. `to` and
 * `api` carry the same filters, because the tile's count is the `meta.total`
 * of that list: it cannot disagree with the page it opens.
 */
export interface FeatureCue {
  id: string;
  roles: readonly Role[];
  /** The web route with its filters. */
  to: string;
  /** The API list with the same filters, after `/api/v1`. */
  api: string;
  /** What the list needs, when that is not the feature's own permission. */
  permission?: Permission;
}

/**
 * What an area gives the shell: a route, menu entries, tiles for role home
 * pages, and a text namespace (`locales/en/<namespace>.json`, loaded on
 * demand). The page is its own chunk.
 */
export interface Feature {
  id: string;
  namespace: string;
  /** The first URL segment, such as "orders" for /orders. */
  path: string;
  /** The permission that shows the menu entries and opens the route. */
  permission?: Permission;
  menu: readonly MenuEntry[];
  cues: readonly FeatureCue[];
  /**
   * True while the page is only a placeholder. The registry then leaves the
   * feature out of everything a person can reach, unless a developer switched
   * it on. The story that builds the page removes this line.
   */
  planned?: true;
  Page: LazyExoticComponent<ComponentType>;
  /** Routes below the feature, such as `:id`. They share its guard. */
  children?: RouteObject[];
}

export function defineFeature(feature: Feature): Feature {
  return feature;
}

interface PageModule {
  default: ComponentType;
}

/**
 * The page of a planned feature. Pass the loader only in development:
 * `devOnlyPage(import.meta.env.DEV ? () => import("./X") : undefined)`. A
 * production build then drops the import, so the placeholder's chunk and its
 * text are not in what ships.
 */
export function devOnlyPage(
  load: (() => Promise<PageModule>) | undefined,
): LazyExoticComponent<ComponentType> {
  return lazy(
    load ?? (() => Promise.reject(new Error("This page is not available"))),
  );
}
