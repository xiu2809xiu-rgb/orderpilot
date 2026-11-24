import { describe, expect, it } from "vitest";
import {
  PICTURE_AI_STATUSES,
  PICTURE_CONCERNS,
  PICTURE_REFUSALS,
  PICTURE_REJECTION_REASONS,
  PICTURE_TAKE_DOWN_REASONS,
  PROFILE_PICTURE_LIMITS,
  hasNoControlCharacters,
  myPictureSchema,
  pictureListQuerySchema,
  pictureRejectRequestSchema,
  pictureRoutes,
  pictureTakeDownRequestSchema,
  profilePictureImagePath,
} from "./profile-pictures.js";

function hasDuplicates(list: readonly string[]): boolean {
  return new Set(list).size !== list.length;
}

describe("the profile picture lists", () => {
  it("hold no duplicate", () => {
    for (const list of [
      PICTURE_CONCERNS,
      PICTURE_REJECTION_REASONS,
      PICTURE_TAKE_DOWN_REASONS,
      PICTURE_REFUSALS,
      PICTURE_AI_STATUSES,
    ]) {
      expect(hasDuplicates(list)).toBe(false);
    }
  });

  it("let a reviewer take down for every reason they may reject for", () => {
    for (const reason of PICTURE_REJECTION_REASONS) {
      expect(PICTURE_TAKE_DOWN_REASONS).toContain(reason);
    }
    expect(PICTURE_TAKE_DOWN_REASONS).toContain("reported");
  });

  it("name the refusals the web words, including the three that are not file errors", () => {
    for (const code of ["too_big", "upload_busy", "rejected_before"]) {
      expect(PICTURE_REFUSALS).toContain(code);
    }
  });

  it("fix the limits the screens and the server share", () => {
    expect(PROFILE_PICTURE_LIMITS).toEqual({
      maxBytes: 262_144,
      minSide: 128,
      maxSide: 512,
      uploadsPer24Hours: 10,
      rejectedRepeatDays: 30,
    });
  });
});

describe("a note to the owner", () => {
  it("is needed when the reason is other", () => {
    expect(
      pictureRejectRequestSchema.safeParse({ reasonCode: "other" }).success,
    ).toBe(false);
    expect(
      pictureRejectRequestSchema.safeParse({
        reasonCode: "other",
        note: "   ",
      }).success,
    ).toBe(false);
    expect(
      pictureRejectRequestSchema.safeParse({
        reasonCode: "other",
        note: "A logo, not a face",
      }).success,
    ).toBe(true);
  });

  it("is optional for the other reasons and trimmed", () => {
    const parsed = pictureRejectRequestSchema.parse({
      reasonCode: "not_clear",
      note: "  too dark  ",
    });
    expect(parsed.note).toBe("too dark");
    expect(
      pictureRejectRequestSchema.safeParse({ reasonCode: "not_clear" }).success,
    ).toBe(true);
  });

  it("is refused with a control character or over 140 characters", () => {
    for (const note of [
      "a\u0000b",
      "line\nbreak",
      "tab\there",
      "x".repeat(141),
    ]) {
      expect(
        pictureRejectRequestSchema.safeParse({ reasonCode: "other", note })
          .success,
      ).toBe(false);
    }
  });

  it("allows reported for a take-down and not for a rejection", () => {
    expect(
      pictureTakeDownRequestSchema.safeParse({ reasonCode: "reported" })
        .success,
    ).toBe(true);
    expect(
      pictureRejectRequestSchema.safeParse({ reasonCode: "reported" }).success,
    ).toBe(false);
  });
});

describe("hasNoControlCharacters", () => {
  it("refuses NUL, tab, newline and code 127", () => {
    for (const code of [0, 9, 10, 13, 31, 127]) {
      expect(hasNoControlCharacters(`a${String.fromCharCode(code)}b`)).toBe(
        false,
      );
    }
  });

  it("accepts ordinary text with accents and spaces", () => {
    expect(hasNoControlCharacters("Café, naïve and 日本語 are fine")).toBe(
      true,
    );
    expect(hasNoControlCharacters("")).toBe(true);
  });
});

describe("the routes and queries", () => {
  it("lists pending pictures first and pages like every list", () => {
    expect(pictureListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      status: "PENDING",
    });
    expect(
      pictureListQuerySchema.safeParse({ status: "REJECTED" }).success,
    ).toBe(false);
  });

  it("names the image path under the API base", () => {
    expect(profilePictureImagePath("abc")).toBe(
      "/api/v1/profile-pictures/abc/image",
    );
  });

  it("describes the raw upload without a JSON request", () => {
    expect(pictureRoutes.upload.rawContentType).toBe("image/jpeg");
    expect(pictureRoutes.upload.request).toBeNull();
    expect(pictureRoutes.upload.csrf).toBe(true);
    expect(pictureRoutes.mine.csrf).toBe(false);
  });

  it("gives the owner the AI status and nothing else about the check", () => {
    const parsed = myPictureSchema.parse({
      approved: null,
      pending: {
        id: "0190a000-0000-7000-8000-000000000001",
        createdAt: "2026-11-24T00:00:00.000Z",
        ai: { status: "NOT_ALLOWED", verdict: "LOOKS_FINE", why: "x" },
      },
      notice: null,
      uploads: { used: 1, limit: 10 },
    });
    expect(parsed.pending?.ai).toEqual({ status: "NOT_ALLOWED" });
  });
});
