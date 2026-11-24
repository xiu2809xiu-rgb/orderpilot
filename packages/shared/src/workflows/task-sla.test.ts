import { describe, expect, it } from "vitest";
import { DEFAULT_TASK_SLAS } from "./index.js";

describe("the default task SLAs (ADR 0058)", () => {
  it("passes every overdue task up to the approvers, except the SPR approval, which still goes to Management until the role cut", () => {
    // Spectra's one stated rule is an approval not actioned in 24 hours going to
    // management. Management still signs in until step 6 of the role cut, so
    // APPROVE_SPR keeps naming it until then, and the rule keeps working through
    // steps 4 and 5. Every other default passes up to the approvers.
    const expected = (kind: string) =>
      kind === "APPROVE_SPR" ? "MANAGEMENT" : "APPROVER";
    const wrong = DEFAULT_TASK_SLAS.filter(
      (sla) => sla.escalateToRole !== expected(sla.taskKind),
    );
    expect(DEFAULT_TASK_SLAS.length).toBeGreaterThan(0);
    expect(wrong.map((sla) => sla.taskKind)).toEqual([]);
    expect(
      DEFAULT_TASK_SLAS.find((sla) => sla.taskKind === "APPROVE_SPR"),
    ).toMatchObject({ escalateAfterMinutes: 0, escalateToRole: "MANAGEMENT" });
  });
});
