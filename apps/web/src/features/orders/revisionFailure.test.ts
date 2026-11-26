import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { revisionFailureOf } from "./revisionFailure";

const api = (
  status: number,
  code: ConstructorParameters<typeof ApiError>[0],
  details: { path: string; message: string }[] = [],
  fromEnvelope = true,
) =>
  new ApiError(
    code,
    "The server's words.",
    status,
    "trace-1",
    details,
    fromEnvelope,
  );

describe("sorting what a failed preview or confirmation proves", () => {
  it("lists the issues of a 400 that names fields", () => {
    expect(
      revisionFailureOf(
        api(400, "VALIDATION_FAILED", [
          { path: "lines.0.itemNo", message: "No item has this number." },
        ]),
      ),
    ).toEqual({
      kind: "fields",
      message: "The server's words.",
      issues: ["No item has this number."],
      traceId: "trace-1",
    });
  });

  it("reads the number the order is at now from a 409 with currentPoVersionNo", () => {
    expect(
      revisionFailureOf(
        api(409, "CONFLICT", [{ path: "currentPoVersionNo", message: "3" }]),
      ),
    ).toMatchObject({ kind: "stale", current: 3 });
    expect(
      revisionFailureOf(
        api(409, "CONFLICT", [{ path: "currentPoVersionNo", message: "x" }]),
      ),
    ).toMatchObject({ kind: "stale", current: null });
  });

  it("calls a 409 with a state closed", () => {
    expect(
      revisionFailureOf(
        api(409, "CONFLICT", [{ path: "captureState", message: "void" }]),
      ),
    ).toMatchObject({ kind: "closed" });
  });

  it("calls any other answer in the envelope refused, whatever its status", () => {
    expect(revisionFailureOf(api(409, "CONFLICT"))).toMatchObject({
      kind: "refused",
    });
    expect(revisionFailureOf(api(400, "VALIDATION_FAILED"))).toMatchObject({
      kind: "refused",
    });
    expect(revisionFailureOf(api(403, "FORBIDDEN"))).toMatchObject({
      kind: "refused",
    });
  });

  it("calls a 5xx, a page that is not ours and a dead network unknown", () => {
    expect(revisionFailureOf(api(500, "INTERNAL_ERROR"))).toEqual({
      kind: "unknown",
      traceId: "trace-1",
    });
    expect(revisionFailureOf(api(409, "CONFLICT", [], false))).toMatchObject({
      kind: "unknown",
    });
    expect(revisionFailureOf(new NetworkError("offline", "trace-2"))).toEqual({
      kind: "unknown",
      traceId: "trace-2",
    });
    expect(revisionFailureOf(new Error("boom"))).toEqual({ kind: "unknown" });
  });
});
