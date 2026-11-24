import { describe, expect, it } from "vitest";
import { AROUND_RADIUS, aroundRange, peopleFrom } from "./filter-options.js";

describe("the events around a sequence (F-9)", () => {
  it("takes five sequences either side", () => {
    expect(AROUND_RADIUS).toBe(5);
    expect(aroundRange(40)).toEqual({ from: 35, to: 45 });
  });

  it("never starts before the first sequence", () => {
    expect(aroundRange(3)).toEqual({ from: 1, to: 8 });
    expect(aroundRange(1)).toEqual({ from: 1, to: 6 });
  });
});

describe("the people the actor filter offers (F-9)", () => {
  const names = new Map([
    ["u-3", "Wei Warehouse"],
    ["u-1", "Farah Finance"],
    ["u-2", "Aisha Auditor"],
  ]);

  it("names each person, sorted by name", () => {
    expect(peopleFrom(["u-3", "u-1", "u-2"], names)).toEqual([
      { id: "u-2", name: "Aisha Auditor" },
      { id: "u-1", name: "Farah Finance" },
      { id: "u-3", name: "Wei Warehouse" },
    ]);
  });

  it("lists each person once", () => {
    expect(peopleFrom(["u-1", "u-1"], names)).toEqual([
      { id: "u-1", name: "Farah Finance" },
    ]);
  });

  it("keeps a person the users table does not name, as Unknown user", () => {
    expect(peopleFrom(["u-9", "u-1"], names)).toEqual([
      { id: "u-1", name: "Farah Finance" },
      { id: "u-9", name: "Unknown user" },
    ]);
  });

  it("holds nothing but the id and the name", () => {
    for (const person of peopleFrom(["u-1"], names)) {
      expect(Object.keys(person).sort()).toEqual(["id", "name"]);
    }
  });
});
