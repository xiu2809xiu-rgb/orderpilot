import { describe, expect, it } from "vitest";
import { addedBlockOf, homeBlockOf } from "./homeAccess";

describe("homeBlockOf", () => {
  it("gives a role with an inbox its tasks, whatever else it may do", () => {
    expect(homeBlockOf(true, [])).toBe("tasks");
    expect(homeBlockOf(true, ["settings.manage", "audit.read"])).toBe("tasks");
  });

  it("gives a role without an inbox that manages settings the rules, also when it reads the audit trail", () => {
    expect(homeBlockOf(false, ["settings.manage"])).toBe("rules");
    expect(homeBlockOf(false, ["settings.manage", "audit.read"])).toBe("rules");
  });

  it("gives a role that reads the audit trail and manages no settings the refused actions", () => {
    expect(homeBlockOf(false, ["audit.read", "tracker.read"])).toBe("refused");
  });

  it("gives a role with neither the overdue orders", () => {
    expect(homeBlockOf(false, ["tracker.read", "insights.read"])).toBe(
      "overdue",
    );
    expect(homeBlockOf(false, [])).toBe("overdue");
  });
});

describe("addedBlockOf", () => {
  it("adds the overdue orders to the tasks only with approvals.decide and tracker.read", () => {
    expect(addedBlockOf("tasks", ["approvals.decide", "tracker.read"])).toBe(
      "overdue",
    );
    expect(addedBlockOf("tasks", ["approvals.decide"])).toBeNull();
    expect(addedBlockOf("tasks", ["tracker.read"])).toBeNull();
    expect(addedBlockOf("tasks", [])).toBeNull();
  });

  it("adds the refused actions to the rules only with audit.read", () => {
    expect(addedBlockOf("rules", ["settings.manage", "audit.read"])).toBe(
      "refused",
    );
    expect(addedBlockOf("rules", ["settings.manage"])).toBeNull();
  });

  it("adds nothing to the other blocks, whatever the permissions", () => {
    const all = [
      "approvals.decide",
      "tracker.read",
      "audit.read",
      "settings.manage",
    ] as const;
    expect(addedBlockOf("overdue", all)).toBeNull();
    expect(addedBlockOf("refused", all)).toBeNull();
  });

  it("does not add the refused actions to the tasks, nor the overdue orders to the rules", () => {
    expect(addedBlockOf("tasks", ["audit.read"])).toBeNull();
    expect(
      addedBlockOf("rules", ["approvals.decide", "tracker.read"]),
    ).toBeNull();
  });
});
