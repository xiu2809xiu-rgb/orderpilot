import { DEMO_PERSONAS, ROLES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { TEAM } from "./names.js";
import { createSyntheticDataset } from "./index.js";

const data = createSyntheticDataset();

describe("the team", () => {
  it("has three management approvers, Rachel Goh first", () => {
    const approvers = data.people.filter((p) => p.role === "APPROVER");
    expect(approvers.map((p) => p.name)).toEqual([
      "Rachel Goh",
      "Marcus Teo",
      "Farah Ismail",
    ]);
  });

  it("has one SPR coordinator, a Support person", () => {
    const coordinators = data.people.filter((p) => p.sprCoordinator);
    expect(coordinators.map((p) => [p.name, p.role])).toEqual([
      ["Michelle Lau", "SUPPORT"],
    ]);
  });

  it("never gives the coordinator an order, a task or a confirmation", () => {
    const owned = data.orders.flatMap((order) => [
      order.owners.support,
      order.owners.productManager,
      order.owners.approver,
      order.owners.finance,
      order.owners.warehouse,
      order.owners.logistics,
      ...order.documents.map((doc) => doc.confirmedBy),
    ]);
    expect(owned).not.toContain("Michelle Lau");
    const assigned = data.tasks.map((task) => task.assigneeName);
    expect(assigned).not.toContain("Michelle Lau");
  });

  it("keeps the first person of each role as the demo persona", () => {
    for (const role of ROLES) {
      const first = TEAM.find((member) => member.role === role);
      if (first) expect(first.name).toBe(DEMO_PERSONAS[role]);
    }
  });

  it("keeps Support orders with the same two people as before", () => {
    const supports = new Set(data.orders.map((order) => order.owners.support));
    expect([...supports].sort()).toEqual(["Daryl Foo", "Mei Tan"]);
  });
});
