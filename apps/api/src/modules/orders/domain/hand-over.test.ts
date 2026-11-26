import { describe, expect, it } from "vitest";
import { ConflictError } from "../../../common/domain-error.js";
import { handOver } from "./hand-over.js";
import { HandoffRefusedError } from "./order-errors.js";

describe("handOver", () => {
  it("wraps a DomainError so the transaction can tell the port said no", async () => {
    const refusal = new ConflictError("Order SO-1 is held.");
    const error = await handOver(() => Promise.reject(refusal)).catch(
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(HandoffRefusedError);
    expect((error as HandoffRefusedError).refusal).toBe(refusal);
  });

  it("rethrows anything else untouched", async () => {
    const failure = new Error("the port broke");
    await expect(handOver(() => Promise.reject(failure))).rejects.toBe(failure);
  });

  it("returns the effect", async () => {
    expect(await handOver(() => Promise.resolve({ effect: "applied" }))).toBe(
      "applied",
    );
    expect(await handOver(() => Promise.resolve({ effect: "none" }))).toBe(
      "none",
    );
  });
});
