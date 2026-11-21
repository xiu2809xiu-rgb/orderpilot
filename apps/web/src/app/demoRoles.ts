import type { AuthOptions, Role } from "@orderpilot/shared";

/**
 * The teams that handle one sales order, in the order the order passes through
 * them. The sign-in page and the Demo role menu both lead with these, so a
 * person who follows the order never has to hunt for the next team. It is not
 * the order of `ROLES` in the shared package: that one drives the permission
 * matrix, and this one is only about telling the story.
 */
export const FLOW_ROLES: readonly Role[] = [
  "SUPPORT",
  "PRODUCT_MANAGER",
  "APPROVER",
  "FINANCE",
  "WAREHOUSE",
  "LOGISTICS",
];

export type DemoRole = AuthOptions["demoRoles"][number];

export interface FlowRole extends DemoRole {
  /** Its place in the flow, counted from 1 over the teams actually offered. */
  step: number;
}

export interface SplitDemoRoles {
  flow: FlowRole[];
  more: DemoRole[];
}

/**
 * The API decides which roles can be demonstrated; this only orders them. A
 * flow role the API does not offer is skipped and the numbers close up, so the
 * list can shrink later without a change here. Every other role keeps the
 * API's order, under "More roles".
 */
export function splitDemoRoles(roles: readonly DemoRole[]): SplitDemoRoles {
  const flow: FlowRole[] = [];
  for (const role of FLOW_ROLES) {
    const offered = roles.find((entry) => entry.role === role);
    if (offered) flow.push({ ...offered, step: flow.length + 1 });
  }
  const more = roles.filter((entry) => !FLOW_ROLES.includes(entry.role));
  return { flow, more };
}
