import { describe, expect, it } from "vitest";
import { lockWait } from "./lockWait";

describe("the wait of a lock", () => {
  it("rounds a lock of 900 seconds up to 15 minutes", () => {
    expect(lockWait(900)).toEqual({ unit: "minutes", count: 15 });
    expect(lockWait(841)).toEqual({ unit: "minutes", count: 15 });
    expect(lockWait(1)).toEqual({ unit: "minutes", count: 1 });
  });

  it("uses minutes up to and including 90 minutes", () => {
    expect(lockWait(5_400)).toEqual({ unit: "minutes", count: 90 });
  });

  it("uses hours above 90 minutes and rounds up", () => {
    expect(lockWait(5_401)).toEqual({ unit: "hours", count: 2 });
    expect(lockWait(7_201)).toEqual({ unit: "hours", count: 3 });
  });

  it("reads 86,400 seconds as 24 hours", () => {
    expect(lockWait(86_400)).toEqual({ unit: "hours", count: 24 });
  });

  it("gives nothing for a missing header, so the plain text shows", () => {
    expect(lockWait(null)).toBeNull();
  });
});
