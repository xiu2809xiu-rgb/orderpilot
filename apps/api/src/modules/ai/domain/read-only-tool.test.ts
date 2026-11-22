import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineReadOnlyTool } from "./read-only-tool.js";

const base = {
  description: "Looks something up.",
  inputSchema: z.object({ id: z.string() }),
  permission: "orders.read",
  execute: () => Promise.resolve(null),
} as const;

describe("defineReadOnlyTool", () => {
  it("returns the tool as it was given", () => {
    const tool = defineReadOnlyTool({ ...base, name: "order_lookup" });
    expect(tool.name).toBe("order_lookup");
    expect(tool.permission).toBe("orders.read");
  });

  it.each(["", "1abc", "has space", "has.dot", "x".repeat(65)])(
    "refuses the name %j, which a provider would reject",
    (name) => {
      expect(() => defineReadOnlyTool({ ...base, name })).toThrow(RangeError);
    },
  );

  it("refuses a tool the model could not choose, for it has no description", () => {
    expect(() =>
      defineReadOnlyTool({ ...base, name: "order_lookup", description: " " }),
    ).toThrow(RangeError);
  });
});
