import { syntheticDataset } from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import { SampleOrderSource } from "./sample-order-source.js";

const source = new SampleOrderSource(() => syntheticDataset());

describe("SampleOrderSource", () => {
  it("answers for all 120 samples, none with a capture state", async () => {
    const all = await source.list();
    expect(all).toHaveLength(120);
    expect(
      all.every((o) => o.source === "sample" && o.captureState === null),
    ).toBe(true);
    expect(all.every((o) => o.workflowStatus !== null)).toBe(true);
  });

  it("finds a sample by its number and nothing for a stored one", async () => {
    expect((await source.find("SO-0001"))?.orderNo).toBe("SO-0001");
    expect(await source.find("SO-20261108-0001")).toBeNull();
  });
});
