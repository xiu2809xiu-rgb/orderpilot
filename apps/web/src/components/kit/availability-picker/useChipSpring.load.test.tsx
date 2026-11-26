import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { loadSpring } from "./useChipSpring";

// The spring library's fetch fails while `failures` is above the count of asks,
// as it does offline, and then it arrives. The mock factory runs once for each
// ask: a failed one is not kept.
const network = vi.hoisted(() => ({ failures: Infinity, asked: 0 }));
vi.mock("motion/react", () => {
  network.asked += 1;
  if (network.asked <= network.failures) throw new Error("offline");
  return { animate: () => undefined };
});

loadPicker();

beforeEach(() => {
  // A browser can be observed; without this the kit holds still and asks for no spring.
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

const quiet = () => new Promise((resolve) => setTimeout(resolve, 100));

describe("the spring library's fetch", () => {
  it("leaves no rejected promise behind when hover, focus and the opening pill ask for it offline", async () => {
    const lost: unknown[] = [];
    const note = (reason: unknown) => lost.push(reason);
    process.on("unhandledRejection", note);
    try {
      const user = userEvent.setup();
      renderPicker();
      const trigger = screen.getByRole("button", {
        name: /^Your availability/,
      });
      await user.hover(trigger);
      trigger.focus();
      await user.keyboard("{Enter}");
      await screen.findByRole("menu");
      await quiet();
      expect(network.asked, "hover and the pill both asked").toBeGreaterThan(1);
      expect(lost).toEqual([]);
    } finally {
      process.off("unhandledRejection", note);
    }
  });

  it("forgets a failed fetch, so that the next ask tries again", async () => {
    // The next ask fails, and the one after it arrives.
    network.failures = network.asked + 1;
    await expect(loadSpring()).rejects.toThrow();
    await expect(loadSpring()).resolves.toBeUndefined();
    await expect(loadSpring()).resolves.toBeUndefined();
  });
});
