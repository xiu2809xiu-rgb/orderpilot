// Every feature the shell knows about, in menu order: within a module, entries
// follow this list. An area adds its feature here and nowhere else in the app
// shell. Names follow docs/team/module-ownership.md.
import type { Feature } from "./define";
import workflows from "./workflows";
import documents from "./documents";
import orders from "./orders";
import orderTracker from "./order-tracker";
import exceptions from "./exceptions";
import masterData from "./master-data";
import insights from "./insights";
import constellation from "./constellation";
import governance from "./governance";
import audit from "./audit";
import monitoring from "./monitoring";
import mapping from "./mapping";
import connectors from "./connectors";

export const allFeatures: readonly Feature[] = [
  workflows,
  orders,
  documents,
  orderTracker,
  exceptions,
  masterData,
  insights,
  constellation,
  governance,
  audit,
  monitoring,
  mapping,
  connectors,
];

/**
 * Developers can bring planned features back to see what is coming. It needs a
 * development build and VITE_SHOW_PLANNED=true in the root .env, so a
 * production build never shows them, and a teammate's screenshots look like
 * production unless they ask.
 */
export function showPlannedFeatures(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_SHOW_PLANNED === "true";
}

/**
 * The features a person can reach. This is the one place that decides it:
 * the menu, the routes, the palette, the home page and the breadcrumbs all
 * read from here, so a planned feature is in none of them.
 */
export function reachableFeatures(
  list: readonly Feature[] = allFeatures,
  withPlanned: boolean = showPlannedFeatures(),
): Feature[] {
  return list.filter((feature) => withPlanned || feature.planned !== true);
}

export const features: readonly Feature[] = reachableFeatures();
