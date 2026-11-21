import { DEMO_PERSONAS, ROLES, type Role } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { FLOW_ROLES, splitDemoRoles } from "./demoRoles";

function offer(roles: readonly Role[]) {
  return roles.map((role) => ({ role, displayName: DEMO_PERSONAS[role] }));
}

describe("the demo roles in flow order", () => {
  it("puts the six teams first, in the order an order passes through them, numbered 1 to 6", () => {
    const { flow } = splitDemoRoles(offer(ROLES));
    expect(flow.map(({ role, step }) => [step, role])).toEqual([
      [1, "SUPPORT"],
      [2, "PRODUCT_MANAGER"],
      [3, "APPROVER"],
      [4, "FINANCE"],
      [5, "WAREHOUSE"],
      [6, "LOGISTICS"],
    ]);
    expect(flow.map(({ role }) => role)).toEqual([...FLOW_ROLES]);
  });

  it("keeps every other role, in the API's order, for More roles", () => {
    const { more } = splitDemoRoles(offer(ROLES));
    expect(more.map(({ role }) => role)).toEqual([
      "SYSTEM_ADMIN",
      "MANAGEMENT",
      "AUDITOR",
    ]);
    const reversed = splitDemoRoles(offer([...ROLES].reverse())).more;
    expect(reversed.map(({ role }) => role)).toEqual([
      "AUDITOR",
      "MANAGEMENT",
      "SYSTEM_ADMIN",
    ]);
  });

  it("works for the list of the future, with no Management and no Auditor", () => {
    const shorter = ROLES.filter(
      (role) => role !== "MANAGEMENT" && role !== "AUDITOR",
    );
    const { flow, more } = splitDemoRoles(offer(shorter));
    expect(flow).toHaveLength(6);
    expect(more.map(({ role }) => role)).toEqual(["SYSTEM_ADMIN"]);
  });

  it("skips a flow role the API does not offer and closes the numbers up", () => {
    const { flow } = splitDemoRoles(
      offer(ROLES.filter((role) => role !== "APPROVER")),
    );
    expect(flow.map(({ role, step }) => [step, role])).toEqual([
      [1, "SUPPORT"],
      [2, "PRODUCT_MANAGER"],
      [3, "FINANCE"],
      [4, "WAREHOUSE"],
      [5, "LOGISTICS"],
    ]);
  });

  it("keeps the persona the API sent", () => {
    const { flow } = splitDemoRoles(offer(["FINANCE"]));
    expect(flow[0]).toEqual({
      role: "FINANCE",
      displayName: DEMO_PERSONAS.FINANCE,
      step: 1,
    });
  });
});
