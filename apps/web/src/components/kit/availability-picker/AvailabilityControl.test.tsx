import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { dropdownMenuModule } from "@/app/shell/overlays/dropdown-menu";
import { must } from "@/test/must";
import { pickerModule } from "./AvailabilityControl";
import { renderPicker } from "./availabilityTestKit";

// Nothing here loads a chunk first, so the first tests see the stand-in. The
// modules load once per file, so the order of these tests matters.

const NAME = "Your availability: Available. Change";

describe("the availability control before its chunks have arrived", () => {
  it("draws the real trigger's name and its menu attributes from the first paint", () => {
    renderPicker();
    expect(dropdownMenuModule.current()).toBeUndefined();
    const stand = screen.getByRole("button", { name: NAME });
    expect(stand).toHaveAttribute("aria-haspopup", "menu");
    expect(stand).toHaveAttribute("aria-expanded", "false");
    expect(stand.querySelector(".ap-dot")).not.toBeNull();
  });

  it("opens the menu when the chunk has loaded after a click that came early", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole("button", { name: NAME }));
    expect(
      await screen.findByRole("menu", { name: "Your availability" }),
    ).toBeVisible();
    expect(dropdownMenuModule.current()).toBeDefined();
    expect(pickerModule.current()).toBeDefined();
  });
});

describe("the availability control once its chunks have arrived", () => {
  it("keeps one status node and one hidden description beside the trigger", () => {
    renderPicker();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    const hidden = document.querySelector("span[hidden]");
    expect(must(hidden).textContent).toBe(
      "It goes back to Available after 12 hours.",
    );
  });

  it("gives the real trigger the focus the stand-in had", async () => {
    renderPicker();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: NAME })).toBeVisible();
    });
    const trigger = screen.getByRole("button", { name: NAME });
    trigger.focus();
    expect(trigger).toHaveFocus();
  });
});
