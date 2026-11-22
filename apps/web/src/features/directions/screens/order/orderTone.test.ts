import { describe, expect, it } from "vitest";
import { orderTone } from "./orderTone";

describe("orderTone", () => {
  it("is normal when nothing holds the order and it is not overdue", () => {
    expect(orderTone(false, false)).toBe("normal");
  });

  it("is a warning when something holds the order, short of being overdue", () => {
    expect(orderTone(false, true)).toBe("warning");
  });

  it("is critical when the order is overdue, whether or not it is also held", () => {
    expect(orderTone(true, false)).toBe("critical");
    expect(orderTone(true, true)).toBe("critical");
  });
});
