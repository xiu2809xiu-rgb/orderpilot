import { PICTURE_REFUSALS } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { PictureRefusalError } from "./picture-refusal.js";

describe("PictureRefusalError", () => {
  it("carries the machine code in details, and plain English in the message", () => {
    const error = new PictureRefusalError("not_square");
    expect(error.refusal).toBe("not_square");
    expect(error.details).toEqual([{ path: "picture", message: "not_square" }]);
    expect(error.message).toBe("The picture must be square.");
  });

  it("maps every refusal to the status of its kind", () => {
    const status = (code: (typeof PICTURE_REFUSALS)[number]): number =>
      new PictureRefusalError(code).httpStatus;
    expect(status("damaged")).toBe(400);
    expect(status("rejected_before")).toBe(400);
    expect(status("upload_limit")).toBe(429);
    expect(status("upload_busy")).toBe(429);
    expect(status("own_picture")).toBe(403);
    for (const code of [
      "already_approved",
      "already_rejected",
      "removed_by_owner",
      "replaced",
      "not_approved",
    ] as const) {
      expect(status(code)).toBe(409);
    }
  });

  it("words every code in the shared list", () => {
    for (const code of PICTURE_REFUSALS) {
      const error = new PictureRefusalError(code);
      expect(error.message.length).toBeGreaterThan(10);
      expect(error.message).not.toContain(String.fromCharCode(0x2014));
    }
  });
});
