import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { refusalOf } from "./pictureRefusal";

function refused(status: number, details: { path: string; message: string }[]) {
  return new ApiError(
    "VALIDATION_FAILED",
    "words",
    status,
    "trace-refusal",
    details,
  );
}

describe("refusalOf", () => {
  it("reads the picture code from the first detail", () => {
    expect(
      refusalOf(refused(400, [{ path: "picture", message: "not_square" }])),
    ).toBe("not_square");
  });

  it("calls a 413 too_big, because it carries no code", () => {
    expect(refusalOf(refused(413, []))).toBe("too_big");
  });

  it("ignores a detail about another field, and a code it does not know", () => {
    expect(
      refusalOf(refused(400, [{ path: "email", message: "not_square" }])),
    ).toBeNull();
    expect(
      refusalOf(refused(400, [{ path: "picture", message: "made_up" }])),
    ).toBeNull();
  });

  it("is null for an error that is not an API answer", () => {
    expect(refusalOf(new NetworkError("offline", "trace"))).toBeNull();
    expect(refusalOf("nope")).toBeNull();
  });
});
