import { describe, expect, it } from "vitest";
import { toast, useToastStore } from "@/components/common/toast";
import { resetApp } from "./render";

// The order of these two is the test: the second is only true when the
// set-up cleared what the first left behind. A toast store that outlives a
// test hands its toasts to the next render, where they sit beside that
// test's own for six seconds.
describe("toasts between tests", () => {
  it("leaves a toast behind", () => {
    toast.done("Left over from the test before");
    expect(useToastStore.getState().items).toHaveLength(1);
  });

  it("starts the next test with none", () => {
    expect(useToastStore.getState().items).toEqual([]);
  });

  it("starts a reload inside a test with none", () => {
    toast.done("Shown before the reload");
    resetApp();
    expect(useToastStore.getState().items).toEqual([]);
  });
});
