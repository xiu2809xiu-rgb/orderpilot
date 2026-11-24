import { describe, expect, it } from "vitest";
import { copyChange } from "./copyChange";

describe("what a copy changes for the target (#276)", () => {
  it("counts what the target gains and what it loses", () => {
    expect(
      copyChange(
        ["orders.read", "tracker.read", "audit.read"],
        ["orders.read", "documents.read"],
      ),
    ).toEqual({ gains: 2, loses: 1 });
  });

  it("counts nothing when the two already hold the same, in any order", () => {
    expect(
      copyChange(["orders.read", "audit.read"], ["audit.read", "orders.read"]),
    ).toEqual({ gains: 0, loses: 0 });
  });

  it("counts everything as gained by a role that holds nothing", () => {
    expect(copyChange(["users.read", "roles.read"], [])).toEqual({
      gains: 2,
      loses: 0,
    });
  });
});
