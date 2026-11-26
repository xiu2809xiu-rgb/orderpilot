import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(new URL(name, import.meta.url), "utf8");

describe("the stylesheet of the differences", () => {
  it("is loaded by the component that uses its classes, not only by the order page", () => {
    // The panel is drawn on New order, a route that never loads the order page's
    // chunk. Without this import the item's name and number run together there
    // (.od-customer is a column only in orders.css). CSS is not applied in jsdom,
    // so the import itself is what is checked.
    expect(read("./DifferenceRow.tsx")).toContain("od-customer");
    expect(read("./PoDifferences.tsx")).toMatch(
      /^import "@\/features\/directions\/screens\/orders\/orders\.css";$/m,
    );
  });
});
