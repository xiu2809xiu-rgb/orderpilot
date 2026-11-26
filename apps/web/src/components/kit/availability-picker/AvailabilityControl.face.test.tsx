import { readFileSync } from "node:fs";
import path from "node:path";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { loadShellOverlays } from "@/app/shell/overlays/preload";
import { must } from "@/test/must";
import { renderPicker } from "./availabilityTestKit";

// The sheets are not loaded by the test runner, so the dot's own sheet is
// put in the page, and "faded" is what the browser's cascade says.
const sheet = readFileSync(
  path.join(import.meta.dirname, "availabilityDot.css"),
  "utf8",
);

// An open menu hides the page behind it from the role queries.
const trigger = () => must(document.querySelector<HTMLElement>(".ap-trigger"));
const faceOpacity = () =>
  getComputedStyle(must(trigger().querySelector(".ap-face"))).opacity;

beforeAll(async () => {
  // The shell's menu is in, and the picker's chunk is deliberately not: the
  // first test runs before it has been asked for.
  await loadShellOverlays();
  const style = document.createElement("style");
  style.textContent = sheet;
  document.head.append(style);
});

describe("the dot's face while the menu is open", () => {
  it("is not faded while the pill's code has not arrived, and is once the pill is in the page", async () => {
    renderPicker({ defaultOpen: true });
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger()).not.toHaveAttribute("data-pill-open");
    expect(faceOpacity()).not.toBe("0");
    await screen.findByRole("menu", undefined, { timeout: 8000 });
    await waitFor(() => {
      expect(trigger()).toHaveAttribute("data-pill-open");
    });
    expect(faceOpacity()).toBe("0");
  });

  it("is drawn again once the pill has gone", async () => {
    const user = userEvent.setup();
    renderPicker({ defaultOpen: true });
    await screen.findByRole("menu");
    await waitFor(() => {
      expect(trigger()).toHaveAttribute("data-pill-open");
    });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(trigger()).not.toHaveAttribute("data-pill-open");
    expect(faceOpacity()).not.toBe("0");
  });
});
