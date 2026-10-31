import { describe, it } from "vitest";

// Area 3 (Iok Teck) writes the formulas. The base returns fixed mock lab
// estimates, so each case is named here and left pending.

describe("the KPI formulas", () => {
  it.todo(
    "order-processing time: minutes of staff work per step, from PO received to goods released",
  );
  it.todo(
    "manual touches per order: hand-typed or hand-corrected fields plus hand-offs between groups",
  );
  it.todo(
    "data-entry errors: confirmed values that differ from the truth, per 100 fields",
  );
  it.todo("approval turnaround: hours between an SPR being raised and decided");
  it.todo("overdue orders: orders late on any step, counted by step and owner");
  it.todo("every figure from a lab run stays labelled as a lab estimate");
  it.todo("a measure with no events yet shows as not measured, not as zero");
});
