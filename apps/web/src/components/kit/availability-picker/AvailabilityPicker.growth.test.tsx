import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { GROW_COARSE, GROW_FINE } from "./pickerMotion";

loadPicker();

function pointer(kind: "fine" | "coarse") {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: kind === "coarse" && query.includes("pointer: coarse"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openPill() {
  const user = userEvent.setup();
  renderPicker();
  await user.click(screen.getByRole("button", { name: /^Your availability/ }));
  return screen.findByRole("menu");
}

describe("the pill's growth", () => {
  it("runs on the pop spring on a fine pointer", async () => {
    pointer("fine");
    const pill = await openPill();
    expect(pill.style.getPropertyValue("--ap-spring")).toBe(GROW_FINE.easing);
    expect(pill.style.getPropertyValue("--ap-grow")).toBe(
      `${String(GROW_FINE.ms)}ms`,
    );
  });

  it("keeps the calm token spring on a touch screen", async () => {
    pointer("coarse");
    const pill = await openPill();
    expect(pill.style.getPropertyValue("--ap-spring")).toBe(GROW_COARSE.easing);
    expect(pill.style.getPropertyValue("--ap-grow")).toBe(
      `${String(GROW_COARSE.ms)}ms`,
    );
  });
});
