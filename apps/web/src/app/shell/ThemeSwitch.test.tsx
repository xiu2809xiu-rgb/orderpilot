import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THEME_KEY, applyTheme, useThemeStore } from "@/lib/theme";
import { ThemeSwitch } from "./ThemeSwitch";

/** A device whose colour scheme a test can change, and whose listeners hear it. */
function device(dark: boolean) {
  let matches = dark;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("prefers-color-scheme: dark") && matches;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: () => void) => {
      listeners.delete(listener);
    },
  }));
  return {
    set(next: boolean) {
      matches = next;
      for (const listener of listeners) listener();
    },
  };
}

function choose(preference: "light" | "dark" | "system") {
  act(() => {
    useThemeStore.setState({ preference });
  });
}

// Some tests replace the store's setPreference to see that it is not called.
const realSetPreference = useThemeStore.getState().setPreference;

beforeEach(() => {
  localStorage.removeItem(THEME_KEY);
  useThemeStore.setState({
    preference: "system",
    setPreference: realSetPreference,
  });
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
  vi.unstubAllGlobals();
});

describe("the theme switch", () => {
  it("is a switch named from the locale, on in the light theme and off in the dark", () => {
    choose("light");
    render(<ThemeSwitch />);
    const light = screen.getByRole("switch", { name: "Light theme" });
    expect(light).toHaveAttribute("aria-checked", "true");
    choose("dark");
    expect(light).toHaveAttribute("aria-checked", "false");
  });

  it("chooses Dark when it is switched off, and sets the page's dark class", async () => {
    choose("light");
    applyTheme("light");
    render(<ThemeSwitch />);
    await userEvent.setup().click(screen.getByRole("switch"));
    expect(useThemeStore.getState().preference).toBe("dark");
    expect(localStorage.getItem(THEME_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("chooses Light when it is switched on, and clears the dark class", async () => {
    choose("dark");
    applyTheme("dark");
    render(<ThemeSwitch />);
    await userEvent.setup().click(screen.getByRole("switch"));
    expect(useThemeStore.getState().preference).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("shows what the device gives while the choice is System", () => {
    device(true);
    render(<ThemeSwitch />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("shows the light theme when System and the device is light", () => {
    device(false);
    render(<ThemeSwitch />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("chooses the opposite of what the device gives when it is used under System", async () => {
    device(true);
    render(<ThemeSwitch />);
    await userEvent.setup().click(screen.getByRole("switch"));
    expect(useThemeStore.getState().preference).toBe("light");
  });

  it("follows a choice made elsewhere, such as Settings or the palette, and chooses nothing itself", async () => {
    choose("light");
    const setPreference = vi.fn();
    act(() => {
      useThemeStore.setState({ setPreference });
    });
    render(<ThemeSwitch />);
    const button = screen.getByRole("switch");
    // Let the engine arrive, so that it is the one that follows.
    await waitFor(() => {
      expect(button.querySelectorAll("canvas")).toHaveLength(2);
    });
    choose("dark");
    expect(button).toHaveAttribute("aria-checked", "false");
    choose("light");
    expect(button).toHaveAttribute("aria-checked", "true");
    expect(setPreference).not.toHaveBeenCalled();
  });

  it("follows the device when it changes under System, and chooses nothing itself", () => {
    const phone = device(false);
    const setPreference = vi.fn();
    act(() => {
      useThemeStore.setState({ setPreference });
    });
    render(<ThemeSwitch />);
    const button = screen.getByRole("switch");
    expect(button).toHaveAttribute("aria-checked", "true");
    act(() => {
      phone.set(true);
    });
    expect(button).toHaveAttribute("aria-checked", "false");
    act(() => {
      phone.set(false);
    });
    expect(button).toHaveAttribute("aria-checked", "true");
    expect(setPreference).not.toHaveBeenCalled();
  });
});
