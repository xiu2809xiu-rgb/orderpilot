import { describe, expect, it } from "vitest";
import {
  ACTION_REASON_MAX_LENGTH,
  actionReasonSchema,
} from "./action-reason.js";

describe("the reason for voiding or disabling a record", () => {
  it("asks for a reason in plain words when it is empty or only spaces", () => {
    for (const reason of ["", "   "]) {
      const result = actionReasonSchema.safeParse({ reason });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Enter a reason");
    }
  });

  it("trims a good reason and refuses one that is too long", () => {
    expect(actionReasonSchema.parse({ reason: "  Duplicate  " }).reason).toBe(
      "Duplicate",
    );
    const long = actionReasonSchema.safeParse({
      reason: "x".repeat(ACTION_REASON_MAX_LENGTH + 1),
    });
    expect(long.error?.issues[0]?.message).toBe(
      `Keep the reason to ${String(ACTION_REASON_MAX_LENGTH)} characters or fewer`,
    );
  });
});
