import { describe, expect, it } from "vitest";
import { DEFAULT_TASK_SLAS } from "./index.js";

describe("the default task SLAs (ADR 0058)", () => {
  it("passes every overdue task up to the approvers", () => {
    // The Management role goes in step 6, so no default may name it as the target.
    const notApprover = DEFAULT_TASK_SLAS.filter(
      (sla) => sla.escalateToRole !== "APPROVER",
    );
    expect(DEFAULT_TASK_SLAS.length).toBeGreaterThan(0);
    expect(notApprover.map((sla) => sla.taskKind)).toEqual([]);
  });
});
