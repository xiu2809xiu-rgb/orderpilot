import { describe, expect, it } from "vitest";
import {
  PictureReviewRules,
  type PictureRemoval,
  type ReviewedPicture,
} from "./review-rules.js";

const OWNER = "0190a000-0000-7000-8000-00000000000a";
const REVIEWER = "0190a000-0000-7000-8000-00000000000b";
const rules = new PictureReviewRules();

const picture = (over: Partial<ReviewedPicture> = {}): ReviewedPicture => ({
  userId: OWNER,
  status: "PENDING",
  removal: null,
  ...over,
});
const removed = (removal: PictureRemoval): ReviewedPicture =>
  picture({ status: "REMOVED", removal });

describe("PictureReviewRules", () => {
  it("refuses the owner's own picture first, whatever its status", () => {
    for (const action of ["approve", "reject", "take_down"] as const) {
      for (const status of ["PENDING", "APPROVED", "REJECTED"] as const) {
        expect(rules.judge(action, OWNER, picture({ status }))).toEqual({
          ok: false,
          code: "own_picture",
        });
      }
      expect(rules.judge(action, OWNER, removed("WITHDRAWN"))).toEqual({
        ok: false,
        code: "own_picture",
      });
    }
  });

  it("lets another person approve or reject a pending picture", () => {
    expect(rules.judge("approve", REVIEWER, picture())).toEqual({ ok: true });
    expect(rules.judge("reject", REVIEWER, picture())).toEqual({ ok: true });
  });

  it("names the conflict for each state a picture can be in", () => {
    const cases: [ReviewedPicture, string][] = [
      [picture({ status: "REJECTED" }), "already_rejected"],
      [picture({ status: "APPROVED" }), "already_approved"],
      [removed("REPLACED_BY_APPROVAL"), "already_approved"],
      [removed("TAKEN_DOWN"), "already_approved"],
      [removed("WITHDRAWN"), "removed_by_owner"],
      [removed("REPLACED_BY_UPLOAD"), "replaced"],
    ];
    for (const action of ["approve", "reject"] as const) {
      for (const [state, code] of cases) {
        expect(rules.judge(action, REVIEWER, state)).toEqual({
          ok: false,
          code,
        });
      }
    }
  });

  it("takes down only an approved picture", () => {
    expect(
      rules.judge("take_down", REVIEWER, picture({ status: "APPROVED" })),
    ).toEqual({ ok: true });
    for (const state of [
      picture(),
      picture({ status: "REJECTED" }),
      removed("TAKEN_DOWN"),
      removed("WITHDRAWN"),
    ]) {
      expect(rules.judge("take_down", REVIEWER, state)).toEqual({
        ok: false,
        code: "not_approved",
      });
    }
  });
});
