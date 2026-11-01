import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_FILES, renderDemoFile } from "./demo.js";
import { generated, type Generated } from "./testing/generated.js";

// Dates in the synthetic set move with today, so the same order has other
// dates on another day. A committed file cannot move, and must not need to.
const OTHER_DAYS = ["2026-10-20", "2026-12-15", "2027-03-01"];

let run: Generated;
beforeAll(async () => {
  run = await generated();
});

describe("the demo files across reference dates", () => {
  it.each(OTHER_DAYS)(
    "carry the same content when the set is built for %s",
    async (day) => {
      const other = createSyntheticDataset({ referenceDate: day });
      for (const file of DEMO_FILES) {
        const { pdf, truth } = await renderDemoFile(file, other);
        const before = run.pdf.get(file.stem) ?? new Uint8Array();
        expect(
          Buffer.from(pdf).equals(Buffer.from(before)),
          `${file.stem} on ${day}`,
        ).toBe(true);
        expect(truth, `${file.stem} truth on ${day}`).toEqual(
          run.truth.get(file.stem),
        );
      }
    },
  );

  it("is a real test: the order's own dates do move between those days", () => {
    const base = createSyntheticDataset();
    const later = createSyntheticDataset({ referenceDate: OTHER_DAYS[1] });
    const dateOf = (set: typeof base) =>
      set.orders.find((o) => o.header.no === "SO-0115")?.header.orderDate;
    expect(dateOf(later)).not.toBe(dateOf(base));
    // While what the files carry does not: lines, prices and customer.
    const lines = (set: typeof base) =>
      JSON.stringify(set.orders.find((o) => o.header.no === "SO-0115")?.lines);
    expect(lines(later)).toBe(lines(base));
  });
});
