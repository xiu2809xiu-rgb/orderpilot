import type { Role } from "@orderpilot/shared";

/** A page the smoke test opens: its path, and the name the test reports. */
export interface SmokePage {
  readonly path: string;
  readonly name: string;
}

const home: SmokePage = { path: "/", name: "Home" };
const tracker: SmokePage = { path: "/order-tracker", name: "Order tracker" };
const workflows: SmokePage = { path: "/workflows", name: "Workflows" };

/**
 * Each role's home page and its two main pages, in the order the smoke test
 * opens them with the full page check. This is the one list: a story that
 * makes a page real adds it here. `menu.spec.ts` follows every menu entry and
 * every Ctrl+K place of each role on top, with a lighter check.
 *
 * Pages that are not built (Orders, Documents, Mapping, Connectors and the 3D
 * view) have no address: the web app answers them with the not-found page
 * until their story removes their planned flag.
 */
export const SMOKE_PAGES: Readonly<Record<Role, readonly SmokePage[]>> = {
  SYSTEM_ADMIN: [
    home,
    { path: "/governance", name: "Governance" },
    { path: "/settings", name: "Settings" },
  ],
  PRODUCT_MANAGER: [home, tracker, workflows],
  APPROVER: [home, workflows, tracker],
  SUPPORT: [home, workflows, tracker],
  WAREHOUSE: [home, workflows, tracker],
  FINANCE: [home, workflows, { path: "/exceptions", name: "Exceptions" }],
  LOGISTICS: [home, workflows, tracker],
  MANAGEMENT: [home, tracker, { path: "/insights", name: "Insights" }],
  AUDITOR: [home, { path: "/audit", name: "Audit" }, tracker],
};
