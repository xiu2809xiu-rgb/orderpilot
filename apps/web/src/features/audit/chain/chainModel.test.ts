import type { AuditChainCheck } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { chainModel, slotCentre, type ChainModel } from "./chainModel";

const AT = "2026-11-24T02:00:00.000Z";

function verified(checked: number, through: number | null): AuditChainCheck {
  return {
    ok: true,
    checked,
    verifiedThrough: through,
    brokenAtSequence: null,
    brokenAtEventId: null,
    problem: null,
    checkedAt: AT,
  };
}

function broken(checked: number, at: number): AuditChainCheck {
  return {
    ok: false,
    checked,
    verifiedThrough: checked === 0 ? null : at - 1,
    brokenAtSequence: at,
    brokenAtEventId: "0194f3a0-0000-7000-8000-000000000222",
    problem: "hash-mismatch",
    checkedAt: AT,
  };
}

const times = (count: number, state: string): string[] =>
  Array.from({ length: count }, () => state);
const states = (picture: ChainModel) => picture.blocks.map((b) => b.state);
const numbers = (picture: ChainModel) =>
  picture.blocks.flatMap((b) => (b.sequence === null ? [] : [b.sequence]));

describe("the picture of a chain check (F-10)", () => {
  it("draws a quiet, unnumbered chain before any check, and after a failed one", () => {
    for (const kind of ["never", "failed"] as const) {
      const picture = chainModel({ kind }, 7);
      expect(states(picture)).toEqual(times(7, "waiting"));
      expect(numbers(picture)).toEqual([]);
      expect(picture.travelling).toBe(false);
    }
  });

  it("runs a light while checking, with no count, because the check reports no progress", () => {
    const picture = chainModel({ kind: "checking" }, 7);
    expect(picture.travelling).toBe(true);
    expect(states(picture)).toEqual(times(7, "waiting"));
    expect(numbers(picture)).toEqual([]);
  });

  it("lights as many blocks as fit for a long chain, numbers only the newest, and says there are more", () => {
    const picture = chainModel(
      { kind: "checked", result: verified(1224, 1224) },
      7,
    );
    expect(states(picture)).toEqual(times(7, "verified"));
    expect(numbers(picture)).toEqual([1224]);
    expect(picture.blocks.at(-1)?.sequence).toBe(1224);
    expect(picture.earlier).toBe(true);
    expect(picture.travelling).toBe(false);
  });

  it("draws one block for each event of a short chain, and no earlier ones", () => {
    const picture = chainModel({ kind: "checked", result: verified(3, 3) }, 7);
    expect(states(picture)).toEqual(["verified", "verified", "verified"]);
    expect(picture.earlier).toBe(false);
  });

  it("draws nothing for an empty trail", () => {
    const picture = chainModel(
      { kind: "checked", result: verified(0, null) },
      7,
    );
    expect(picture.blocks).toEqual([]);
  });

  it("draws the break after the verified events and nothing after it, since the check stops there", () => {
    const picture = chainModel(
      { kind: "checked", result: broken(1221, 1222) },
      7,
    );
    expect(states(picture)).toEqual([...times(6, "verified"), "broken"]);
    expect(numbers(picture)).toEqual([1221, 1222]);
    expect(picture.blocks.at(-1)).toEqual({ state: "broken", sequence: 1222 });
    expect(picture.earlier).toBe(true);
  });

  it("draws the break alone when the very first event does not fit", () => {
    const picture = chainModel({ kind: "checked", result: broken(0, 1) }, 7);
    expect(picture.blocks).toEqual([{ state: "broken", sequence: 1 }]);
    expect(picture.earlier).toBe(false);
  });

  it("fits fewer blocks on a phone", () => {
    const picture = chainModel(
      { kind: "checked", result: broken(1221, 1222) },
      4,
    );
    expect(states(picture)).toEqual([
      "verified",
      "verified",
      "verified",
      "broken",
    ]);
  });

  it("never shows a number the check did not send", () => {
    const results = [
      verified(1, 1),
      verified(5, 905),
      verified(4000, 4123),
      broken(1, 2),
      broken(57, 60),
      broken(9000, 9100),
    ];
    for (const result of results) {
      for (const slots of [4, 7]) {
        const sent = [result.verifiedThrough, result.brokenAtSequence];
        for (const n of numbers(
          chainModel({ kind: "checked", result }, slots),
        )) {
          expect(sent).toContain(n);
        }
      }
    }
  });

  it("centres the blocks in their slots, so each number sits under its block", () => {
    expect(slotCentre(0, 7, 7)).toBeCloseTo(0.5 / 7);
    expect(slotCentre(6, 7, 7)).toBeCloseTo(6.5 / 7);
    // Three blocks in seven slots take the middle three.
    expect(slotCentre(0, 3, 7)).toBeCloseTo(2.5 / 7);
    expect(slotCentre(2, 3, 7)).toBeCloseTo(4.5 / 7);
  });
});
