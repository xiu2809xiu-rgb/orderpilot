import { describe, expect, it, vi } from "vitest";
import { listActions } from "@/lib/actions/registry";
import monitoring from "./index";

// Monitoring opens on Observability, so every way in that means AI usage
// names its tab.
describe("the ways into AI usage", () => {
  it("the System admin's AI use tile opens the AI usage tab", () => {
    const tile = monitoring.cues.find((cue) => cue.id === "aiUse");
    expect(tile?.to).toBe("/monitoring?tab=aiUsage");
  });

  it("the See AI use quick action opens the AI usage tab", () => {
    const action = listActions().find((each) => each.id === "monitoring.ai");
    const navigate = vi.fn();
    void action?.run({ navigate });
    expect(navigate).toHaveBeenCalledWith("/monitoring?tab=aiUsage");
  });
});
