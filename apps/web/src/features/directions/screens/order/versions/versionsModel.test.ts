import { describe, expect, it } from "vitest";
import {
  defaultPair,
  fromOptions,
  movePair,
  pairFits,
  toOptions,
  whoHasIt,
} from "./versionsModel";

describe("the Versions tab model", () => {
  it("the default pair is the previous and the current version", () => {
    expect(defaultPair(2)).toEqual({ from: 1, to: 2 });
    expect(defaultPair(5)).toEqual({ from: 4, to: 5 });
  });

  it("from and to options are constrained", () => {
    expect(fromOptions(4)).toEqual([1, 2, 3]);
    expect(toOptions(2, 4)).toEqual([3, 4]);
    expect(toOptions(3, 4)).toEqual([4]);
    expect(fromOptions(1)).toEqual([]);
  });

  it("choosing the earlier version at or above the later one moves the later one up", () => {
    const pair = { from: 1, to: 2 };
    expect(movePair(pair, { from: 2 }, 4)).toEqual({ from: 2, to: 3 });
    expect(movePair({ from: 1, to: 3 }, { from: 2 }, 4)).toEqual({
      from: 2,
      to: 3,
    });
    expect(movePair(pair, { to: 4 }, 4)).toEqual({ from: 1, to: 4 });
  });

  it("a chosen pair that no longer fits is not used", () => {
    expect(pairFits({ from: 1, to: 3 }, 3)).toBe(true);
    expect(pairFits({ from: 2, to: 2 }, 3)).toBe(false);
    expect(pairFits({ from: 1, to: 4 }, 3)).toBe(false);
  });

  it("the who-has-it sentence only for no status and a number above one", () => {
    expect(whoHasIt({ workflowStatus: null, poVersionNo: 2 })).toBe("noTask");
    expect(whoHasIt({ workflowStatus: null, poVersionNo: 1 })).toBeNull();
    expect(whoHasIt({ workflowStatus: null, poVersionNo: null })).toBeNull();
    expect(
      whoHasIt({ workflowStatus: "Waiting for payment", poVersionNo: 3 }),
    ).toBeNull();
  });
});
