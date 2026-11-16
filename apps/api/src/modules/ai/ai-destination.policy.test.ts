import { describe, expect, it, vi } from "vitest";
import type { PolicyService } from "../governance/policy.service.js";
import { GovernanceAiDestinationPolicy } from "./ai-destination.policy.js";

describe("the destination policy adapter", () => {
  it("hands area 4's policy the request unchanged and returns its decision unchanged", async () => {
    const decision = {
      allowed: false,
      rule: "synthetic-data-only",
      reason: "Only synthetic data may go to groq; this is real data.",
    };
    const checkAiDestination = vi.fn(() => decision);
    const adapter = new GovernanceAiDestinationPolicy({
      checkAiDestination,
    } as unknown as PolicyService);
    const request = {
      provider: "openai-compatible",
      classification: "confidential",
      origin: "real",
    } as const;
    await expect(adapter.decide(request)).resolves.toBe(decision);
    expect(checkAiDestination).toHaveBeenCalledExactlyOnceWith(request);
  });
});
