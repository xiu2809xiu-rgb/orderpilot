import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { axeViolations } from "@/test/axe";
import { loadPicker, renderPicker } from "./availabilityTestKit";

// jsdom draws no colour, so axe's contrast rule is off in axeViolations; the
// pairs are measured in availabilityTones.test.ts, in both schemes. What axe
// sees here is the structure: names, roles, the hidden text and the live region.
loadPicker();

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe.each(["light", "dark"] as const)(
  "axe on the availability control in %s",
  (scheme) => {
    it.each(["dot", "ring"] as const)(
      "finds no violation, closed, in the %s skin",
      async (skin) => {
        if (scheme === "dark") document.documentElement.classList.add("dark");
        const { container } = renderPicker({ skin, start: "DO_NOT_DISTURB" });
        expect(await axeViolations(container)).toEqual([]);
      },
    );

    it.each(["dot", "ring"] as const)(
      "finds no violation, open, in the %s skin",
      async (skin) => {
        if (scheme === "dark") document.documentElement.classList.add("dark");
        const user = userEvent.setup();
        renderPicker({ skin, start: "FOCUSING" });
        await user.click(
          screen.getByRole("button", { name: /^Your availability/ }),
        );
        await screen.findByRole("menu");
        expect(await axeViolations(document.body)).toEqual([]);
      },
    );
  },
);
