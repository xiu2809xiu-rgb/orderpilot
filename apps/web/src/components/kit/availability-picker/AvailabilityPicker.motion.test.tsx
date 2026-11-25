import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { chipPlace, pickerMotion, pillGeometry } from "./pickerMotion";

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
  vi.restoreAllMocks();
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

describe("the glass of the pill", () => {
  const pill = () => screen.getByRole("menu");
  // jsdom has no AnimationEvent, and React listens there for the webkit-prefixed
  // names, so the event is made by hand, under both names, with the animation
  // name React reads. The handlers are idempotent, so a double call is harmless.
  const fireAnimation = (type: "start" | "end", animationName: string) => {
    for (const name of [
      `animation${type}`,
      `webkitAnimation${type === "start" ? "Start" : "End"}`,
    ]) {
      fireEvent(
        pill(),
        Object.assign(new Event(name, { bubbles: true }), { animationName }),
      );
    }
  };

  it("is switched on when the growth ends and is off again on the next opening", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    expect(pill()).not.toHaveAttribute("data-settled");
    fireAnimation("end", "ap-grow");
    expect(pill()).toHaveAttribute("data-settled");
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await open(user);
    expect(pill()).not.toHaveAttribute("data-settled");
  });

  it("is switched off when the fold starts, so the blur does not scale", async () => {
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    fireAnimation("end", "ap-grow");
    expect(pill()).toHaveAttribute("data-settled");
    fireAnimation("start", "ap-fold");
    expect(pill()).not.toHaveAttribute("data-settled");
  });
});

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

  it("fits the caption to the layout width of its word, not to the width it is drawn at while the pill grows", async () => {
    // A scaled pill draws its words at a fraction of their width.
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(100);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 10, 10),
    );
    const user = userEvent.setup();
    renderPicker();
    await open(user);
    expect(chip().style.getPropertyValue("--ap-chip-w")).toBe(
      String(chipPlace(0, 100).w),
    );
    expect(chipPlace(0, 100).w).toBe(100 + pillGeometry.chip.padX);
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
