// Every feature the shell knows about, in menu order: within a module, entries
// follow this list. An area adds its feature here and nowhere else in the app
// shell. Names follow docs/team/module-ownership.md.
import type { Feature } from "./define";
import workflows from "./workflows/index";
import documents from "./documents/index";
import orders from "./orders/index";
import orderTracker from "./order-tracker/index";
import exceptions from "./exceptions/index";
import masterData from "./master-data/index";
import insights from "./insights/index";
import constellation from "./constellation/index";
import governance from "./governance/index";
import audit from "./audit/index";
import monitoring from "./monitoring/index";
import mapping from "./mapping/index";
import connectors from "./connectors/index";

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
