import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY, initTheme, useThemeStore } from "./theme";
import {
  revealReach,
  switchOrigin,
  watchThemeOrigin,
  withThemeTransition,
} from "./themeSwitch";

interface FakeTransition {
  update: () => void;
  finish: () => void;
}

/** A browser with view transitions: the update runs at once, and the test ends the transition. */
function fakeViewTransitions(): FakeTransition[] {
  const started: FakeTransition[] = [];
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: (update: () => void) => {
      let finish: () => void = () => undefined;
      const finished = new Promise<void>((resolve) => {
        finish = resolve;
      });
      started.push({ update, finish });
      update();
      return { ready: Promise.resolve(), finished };
    },
  });
  return started;
}

function lessMotion(wanted: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: wanted && query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

const root = document.documentElement;
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function press(x: number, y: number) {
  document.body.dispatchEvent(
    new MouseEvent("pointerdown", { clientX: x, clientY: y, bubbles: true }),
  );
}
function pressKey() {
  document.body.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
}

beforeEach(() => {
  watchThemeOrigin();
  // Each test starts as after a key press: no remembered pointer position.
  pressKey();
  root.classList.remove("dark");
  localStorage.removeItem(THEME_KEY);
  useThemeStore.setState({ preference: "light" });
});

afterEach(() => {
  Reflect.deleteProperty(document, "startViewTransition");
  delete root.dataset.themeSwitch;
  root.removeAttribute("style");
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("where the new theme opens from", () => {
  it("is the place a person pressed", () => {
    press(1200, 40);
    expect(switchOrigin()).toEqual({ x: 1200, y: 40 });
  });

  it("is the middle of the focused control after a key press", () => {
    const button = document.createElement("button");
    document.body.append(button);
    vi.spyOn(button, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 300,
      width: 80,
      height: 40,
    } as DOMRect);
    button.focus();
    press(5, 5);
    pressKey();
    expect(switchOrigin()).toEqual({ x: 140, y: 320 });
  });

  it("is the middle of the window when nothing was pressed and nothing has focus", () => {
    expect(switchOrigin()).toEqual({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
  });

  it("reaches the farthest corner, and its soft edge beyond", () => {
    // From the top right corner of a 1440 by 900 window the farthest corner is
    // the bottom left one.
    expect(revealReach({ x: 1440, y: 0 }, 1440, 900)).toBeCloseTo(
      Math.hypot(1440, 900) + 64,
      5,
    );
    // From the middle every corner is as far.
    expect(revealReach({ x: 720, y: 450 }, 1440, 900)).toBeCloseTo(
      Math.hypot(720, 450) + 64,
      5,
    );
  });
});

describe("a change of theme", () => {
  it("is made at once where the browser has no view transitions", () => {
    const change = vi.fn();
    withThemeTransition(change, "reveal");
    expect(change).toHaveBeenCalledTimes(1);
    expect(root.dataset.themeSwitch).toBeUndefined();
  });

  it("is made at once, without a transition, for a person who asked for less motion", () => {
    const started = fakeViewTransitions();
    lessMotion(true);
    const change = vi.fn();
    withThemeTransition(change, "reveal");
    expect(change).toHaveBeenCalledTimes(1);
    expect(started).toHaveLength(0);
    expect(root.dataset.themeSwitch).toBeUndefined();
  });

  it("opens from the press, and tidies up when the transition ends", async () => {
    const started = fakeViewTransitions();
    press(1200, 40);
    const change = vi.fn();
    withThemeTransition(change, "reveal");
    expect(started).toHaveLength(1);
    expect(change).toHaveBeenCalledTimes(1);
    expect(root.dataset.themeSwitch).toBe("reveal");
    expect(root.style.getPropertyValue("--theme-x")).toBe("1200px");
    expect(root.style.getPropertyValue("--theme-y")).toBe("40px");
    expect(
      Number.parseFloat(root.style.getPropertyValue("--theme-r")),
    ).toBeGreaterThan(1200);

    started[0]?.finish();
    await settle();
    expect(root.dataset.themeSwitch).toBeUndefined();
    expect(root.style.getPropertyValue("--theme-x")).toBe("");
    expect(root.style.getPropertyValue("--theme-r")).toBe("");
  });

  it("fades, with no point to open from, when the device made the change", () => {
    fakeViewTransitions();
    withThemeTransition(() => undefined, "fade");
    expect(root.dataset.themeSwitch).toBe("fade");
    expect(root.style.getPropertyValue("--theme-x")).toBe("");
  });

  it("leaves a newer change alone when an older one ends", async () => {
    const started = fakeViewTransitions();
    withThemeTransition(() => undefined, "reveal");
    withThemeTransition(() => undefined, "fade");
    started[0]?.finish();
    await settle();
    // The first one ending must not take the second one's marker away.
    expect(root.dataset.themeSwitch).toBe("fade");
    started[1]?.finish();
    await settle();
    expect(root.dataset.themeSwitch).toBeUndefined();
  });
});

describe("choosing a theme", () => {
  it("changes the page inside one transition and remembers the choice", () => {
    const started = fakeViewTransitions();
    useThemeStore.getState().setPreference("dark");
    expect(started).toHaveLength(1);
    expect(root).toHaveClass("dark");
    expect(root.dataset.themeSwitch).toBe("reveal");
    expect(useThemeStore.getState().preference).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  });

  it("animates nothing when the choice does not change the page", () => {
    const started = fakeViewTransitions();
    // The test device is light, so "system" looks the same as "light".
    useThemeStore.getState().setPreference("system");
    expect(started).toHaveLength(0);
    expect(root).not.toHaveClass("dark");
    expect(useThemeStore.getState().preference).toBe("system");
  });

  it("still changes the theme where there are no view transitions", () => {
    useThemeStore.getState().setPreference("dark");
    expect(root).toHaveClass("dark");
    useThemeStore.getState().setPreference("light");
    expect(root).not.toHaveClass("dark");
  });
});

describe("following the device", () => {
  it("fades to the device's theme while the choice is system", () => {
    const started = fakeViewTransitions();
    let dark = false;
    let onChange: () => void = () => undefined;
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return query.includes("prefers-color-scheme") && dark;
          },
          media: query,
          addEventListener: (_: string, listener: () => void) => {
            if (query.includes("prefers-color-scheme")) onChange = listener;
          },
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    useThemeStore.setState({ preference: "system" });
    initTheme();
    expect(root).not.toHaveClass("dark");

    dark = true;
    onChange();
    expect(started).toHaveLength(1);
    expect(root).toHaveClass("dark");
    expect(root.dataset.themeSwitch).toBe("fade");

    // A person who chose a theme keeps it whatever the device does.
    useThemeStore.setState({ preference: "dark" });
    dark = false;
    onChange();
    expect(started).toHaveLength(1);
    expect(root).toHaveClass("dark");
  });
});
