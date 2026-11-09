import { describe, expect, it } from "vitest";
import type { MasterDataReader } from "./domain/master-data-reader.js";
import { CustomerLookup } from "./customer-lookup.js";

const reader = {
  customers: () =>
    Promise.resolve([
      { no: "C-1", name: "Alpha Synthetic Ltd" },
      { no: "C-2", name: "Alpha Synthetic Ltd" },
      { no: "C-3", name: "Gamma Synthetic Pte" },
    ]),
} as unknown as MasterDataReader;

describe("CustomerLookup", () => {
  it("names the numbers asked for, matching on the number and not the name", async () => {
    const names = await new CustomerLookup(reader).namesOf(["C-2", "C-9"]);
    expect([...names]).toEqual([["C-2", "Alpha Synthetic Ltd"]]);
  });
});
