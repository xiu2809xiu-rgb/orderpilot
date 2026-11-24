import { describe, expect, it } from "vitest";
import {
  PictureVisibility,
  type PictureViewer,
  type VisiblePicture,
} from "./picture-visibility.js";

const OWNER = "0190a000-0000-7000-8000-00000000000a";
const OTHER = "0190a000-0000-7000-8000-00000000000b";
const FAMILY = "0190a000-0000-7000-8000-0000000000f1";
const OTHER_FAMILY = "0190a000-0000-7000-8000-0000000000f2";

const visibility = new PictureVisibility();
const picture = (over: Partial<VisiblePicture> = {}): VisiblePicture => ({
  status: "PENDING",
  userId: OWNER,
  sessionFamilyId: null,
  ownerDisabled: false,
  ...over,
});
const viewer = (userId: string, sessionId = FAMILY): PictureViewer => ({
  userId,
  sessionId,
});

describe("PictureVisibility", () => {
  it("shows the owner their pending and approved pictures", () => {
    expect(visibility.canSee(picture(), viewer(OWNER), false)).toBe(true);
    expect(
      visibility.canSee(picture({ status: "APPROVED" }), viewer(OWNER), false),
    ).toBe(true);
  });

  it("shows a reviewer a pending picture of someone else", () => {
    expect(visibility.canSee(picture(), viewer(OTHER), true)).toBe(true);
  });

  it("shows another role an approved picture and not a pending one", () => {
    expect(
      visibility.canSee(picture({ status: "APPROVED" }), viewer(OTHER), false),
    ).toBe(true);
    expect(visibility.canSee(picture(), viewer(OTHER), false)).toBe(false);
  });

  it("shows nobody a rejected or removed picture, a reviewer included", () => {
    for (const status of ["REJECTED", "REMOVED"] as const) {
      expect(visibility.canSee(picture({ status }), viewer(OWNER), true)).toBe(
        false,
      );
      expect(visibility.canSee(picture({ status }), viewer(OTHER), true)).toBe(
        false,
      );
    }
  });

  it("shows nobody anything of a disabled owner", () => {
    for (const status of ["PENDING", "APPROVED"] as const) {
      const disabled = picture({ status, ownerDisabled: true });
      expect(visibility.canSee(disabled, viewer(OWNER), true)).toBe(false);
      expect(visibility.canSee(disabled, viewer(OTHER), false)).toBe(false);
    }
  });

  it("shows a pending demo picture to its own session and to a reviewer, not to another session of the account", () => {
    const demo = picture({ sessionFamilyId: FAMILY });
    expect(visibility.canSee(demo, viewer(OWNER, FAMILY), false)).toBe(true);
    expect(visibility.canSee(demo, viewer(OWNER, OTHER_FAMILY), false)).toBe(
      false,
    );
    expect(visibility.canSee(demo, viewer(OTHER, OTHER_FAMILY), true)).toBe(
      true,
    );
  });

  it("shows an approved picture whatever its session family", () => {
    const approved = picture({ status: "APPROVED", sessionFamilyId: FAMILY });
    expect(
      visibility.canSee(approved, viewer(OWNER, OTHER_FAMILY), false),
    ).toBe(true);
    expect(
      visibility.canSee(approved, viewer(OTHER, OTHER_FAMILY), false),
    ).toBe(true);
  });
});
