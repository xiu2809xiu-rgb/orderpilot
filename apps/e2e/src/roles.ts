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
 * opens them. This is the one list: a story that makes a page real adds it
 * here, and P-39 extends it with every menu entry.
 *
 * Pages that still show a placeholder (Orders, Documents, Mapping, Connectors
 * and the 3D view) are left out until P-39 hides them.
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
