import { describe, expect, it } from "vitest";
import { stepBegan } from "./stepBegan";

const done = (completedAt: string | null) => ({ state: "done", completedAt });

describe("stepBegan", () => {
  it("is the moment the newest finished step was done, whatever the order of the list", () => {
    expect(
      stepBegan([
        done("2026-11-15T08:00:00.000Z"),
        done("2026-11-16T08:00:00.000Z"),
        done("2026-11-14T08:00:00.000Z"),
        { state: "current", completedAt: null },
        { state: "upcoming", completedAt: null },
      ]),
    ).toEqual(new Date("2026-11-16T08:00:00.000Z"));
  });

  it("does not count a step that is not done, even if it carries a time", () => {
    expect(
      stepBegan([
        done("2026-11-14T08:00:00.000Z"),
        { state: "current", completedAt: "2026-11-19T08:00:00.000Z" },
      ]),
    ).toEqual(new Date("2026-11-14T08:00:00.000Z"));
  });

  it("has no answer without a finished step, a time that can be read, or a record", () => {
    expect(
      stepBegan([{ state: "current", completedAt: null }]),
    ).toBeUndefined();
    expect(stepBegan([done(null), done("not a time")])).toBeUndefined();
    expect(stepBegan([])).toBeUndefined();
    expect(stepBegan(undefined)).toBeUndefined();
  });
});
