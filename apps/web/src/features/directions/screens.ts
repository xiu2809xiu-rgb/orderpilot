import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

/**
 * The eight screens of the preview. A screen is in `SCREENS` once it is built;
 * the switch, the side panel and the search offer only those, so nothing in the
 * preview leads to a screen that does not exist.
 */
export const SCREEN_IDS = [
  "signin",
  "home",
  "orders",
  "order",
  "upload",
  "spark",
  "insights",
  "kit",
] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

export interface ScreenDef {
  id: ScreenId;
  Component: LazyExoticComponent<ComponentType>;
  /** What shows while the screen loads, in the screen's own final layout. */
  Skeleton?: ComponentType;
}

export const SCREENS: readonly ScreenDef[] = [
  {
    id: "kit",
    Component: lazy(() => import("./kit/KitScreen")),
  },
];

export const DEFAULT_SCREEN: ScreenId = "kit";

export function findScreen(id: string | undefined): ScreenDef | undefined {
  return SCREENS.find((screen) => screen.id === id);
}

export function isBuilt(id: ScreenId): boolean {
  return SCREENS.some((screen) => screen.id === id);
}

/** What the Spark panel is given by the shell, which owns whether it is open. */
export interface SparkPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The Spark panel, once it is built: the Spark buttons of the top bar and the
 * side panel open it, over any screen. Until then they say, in a tooltip, that
 * it is not wired, and do nothing else.
 */
export const SPARK_PANEL: LazyExoticComponent<
  ComponentType<SparkPanelProps>
> | null = null;
