import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { chipPlace } from "./pickerMotion";

// The spring library is fetched when the first pill opens. Here it never
// arrives, which is what a slow network looks like in the first moments after
// the menu opens: the caption must still move, without a spring.
vi.mock("motion/react", () => new Promise(() => undefined));

loadPicker();

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

describe("the caption before the spring library has arrived", () => {
  it("is placed at once under the next choice, and the pill keeps working", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(
      screen.getByRole("button", { name: /^Your availability/ }),
    );
    const menu = await screen.findByRole("menu");
    await waitFor(() => {
      expect(
        within(menu).getByRole("menuitemradio", { name: "Available" }),
      ).toHaveFocus();
    });
    await user.keyboard("{ArrowRight}");
    const chip = must(document.querySelector<HTMLElement>(".ap-chip"));
    await waitFor(() => {
      expect(chip).toHaveTextContent("Focusing");
    });
    expect(chip.style.getPropertyValue("--ap-chip-x")).toBe(
      String(chipPlace(1, 0).x),
    );
    expect(
      within(menu).getByRole("menuitemradio", { name: "Focusing" }),
    ).toHaveFocus();
  });
});
