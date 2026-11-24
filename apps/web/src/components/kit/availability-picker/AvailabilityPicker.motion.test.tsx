import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { chipPlace, pickerMotion } from "./pickerMotion";

// The spring is motion's; this file replaces it to see what the caption asks
// of it. jsdom has no IntersectionObserver, so the kit's own check makes every
// kit item still: the stub below says the page can be observed, as a browser can.
const animate = vi.hoisted(() => vi.fn());
vi.mock("motion/react", () => ({ animate }));

loadPicker();

function reducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  animate.mockReset();
  animate.mockImplementation(() => ({ stop: vi.fn() }));
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
  reducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const chip = () => must(document.querySelector<HTMLElement>(".ap-chip"));

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Your availability/ }));
  await screen.findByRole("menu");
  await waitFor(() => {
    expect(
      within(screen.getByRole("menu")).getByRole("menuitemradio", {
        name: "Available",
      }),
    ).toHaveFocus();
  });
}

describe("the caption that follows the choice", () => {
  it("is placed at once under the checked item when the pill opens, with no spring", async () => {
    const user = userEvent.setup();
    renderPicker({ start: "FOCUSING" });
    await user.click(
      screen.getByRole("button", { name: /^Your availability/ }),
    );
    await screen.findByRole("menu");
    const place = chipPlace(1, 0);
    expect(chip().style.getPropertyValue("--ap-chip-x")).toBe(String(place.x));
    expect(chip().style.getPropertyValue("--ap-chip-w")).toBe(String(place.w));
    expect(chip()).toHaveTextContent("Focusing");
    expect(animate).not.toHaveBeenCalled();
  });

  it("glides to the next item by a spring with the tokens' stiffness and damping", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.keyboard("{ArrowRight}");
    await waitFor(() => {
      expect(animate).toHaveBeenCalled();
    });
    const [node, values, options] = must(animate.mock.calls.at(-1)) as [
      HTMLElement,
      Record<string, number>,
      Record<string, unknown>,
    ];
    expect(node).toBe(chip());
    const place = chipPlace(1, 0);
    expect(values).toEqual({ "--ap-chip-x": place.x, "--ap-chip-w": place.w });
    expect(options).toEqual({ type: "spring", ...pickerMotion.spring });
    expect(chip()).toHaveTextContent("Focusing");
  });

  it("does not glide when the pill first appears", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    expect(animate).not.toHaveBeenCalled();
  });

  it("places it at once under reduced motion, with no spring", async () => {
    reducedMotion(true);
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    await user.keyboard("{ArrowRight}{ArrowRight}");
    await waitFor(() => {
      expect(chip()).toHaveTextContent("Do not disturb");
    });
    const place = chipPlace(2, 0);
    expect(chip().style.getPropertyValue("--ap-chip-x")).toBe(String(place.x));
    expect(animate).not.toHaveBeenCalled();
  });

  it("is hidden from assistive technology: the words are in the items", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    expect(chip()).toHaveAttribute("aria-hidden", "true");
  });
});
