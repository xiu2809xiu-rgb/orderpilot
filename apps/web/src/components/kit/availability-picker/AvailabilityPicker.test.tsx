import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { loadPicker, renderPicker } from "./availabilityTestKit";
import { REPEAT_WINDOW_MS } from "./openingPress";

loadPicker();

const trigger = () =>
  screen.getByRole("button", { name: /^Your availability/ });
const menu = () => screen.getByRole("menu");
const item = (name: string) =>
  within(menu()).getByRole("menuitemradio", { name });

/** Opens with the keyboard, so the test does not depend on a pointer. */
async function openWithKeyboard(user: ReturnType<typeof userEvent.setup>) {
  trigger().focus();
  await user.keyboard("{Enter}");
  await screen.findByRole("menu");
}

describe("the availability picker", () => {
  it("opens on a click as a menu named exactly Your availability, with three items and one checked", async () => {
    const user = userEvent.setup();
    renderPicker({ start: "FOCUSING" });
    await user.click(trigger());
    const open = await screen.findByRole("menu", { name: "Your availability" });
    const items = within(open).getAllByRole("menuitemradio");
    expect(items.map((el) => el.textContent)).toEqual([
      "Available",
      "Focusing",
      "Do not disturb",
    ]);
    expect(
      items.filter((el) => el.getAttribute("aria-checked") === "true"),
    ).toHaveLength(1);
    expect(item("Focusing")).toHaveAttribute("aria-checked", "true");
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
    ["ArrowDown", "{ArrowDown}"],
  ])("opens on %s", async (_name, keys) => {
    const user = userEvent.setup();
    renderPicker();
    trigger().focus();
    await user.keyboard(keys);
    expect(
      await screen.findByRole("menu", { name: "Your availability" }),
    ).toBeVisible();
  });

  it("opens with focus on the checked item, by mouse and by keyboard", async () => {
    const user = userEvent.setup();
    renderPicker({ start: "DO_NOT_DISTURB" });
    await user.click(trigger());
    await screen.findByRole("menu");
    await waitFor(() => {
      expect(item("Do not disturb")).toHaveFocus();
    });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    await openWithKeyboard(user);
    await waitFor(() => {
      expect(item("Do not disturb")).toHaveFocus();
    });
  });

  it("moves with the four arrows and wraps in both directions", async () => {
    const user = userEvent.setup();
    renderPicker();
    await openWithKeyboard(user);
    await waitFor(() => {
      expect(item("Available")).toHaveFocus();
    });
    await user.keyboard("{ArrowRight}");
    expect(item("Focusing")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(item("Do not disturb")).toHaveFocus();
    // Past the last: back to the first.
    await user.keyboard("{ArrowRight}");
    expect(item("Available")).toHaveFocus();
    // Before the first: to the last, by Left and by Up.
    await user.keyboard("{ArrowLeft}");
    expect(item("Do not disturb")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(item("Focusing")).toHaveFocus();
  });

  it("starts from the ends when the focus is on the menu itself: Left goes to the last choice, Right to the first", async () => {
    const user = userEvent.setup();
    renderPicker({ start: "FOCUSING" });
    await openWithKeyboard(user);
    await waitFor(() => {
      expect(item("Focusing")).toHaveFocus();
    });
    // As after a mouse opening: the pointer rests on an item and leaves it, and
    // Radix puts the focus on the menu itself.
    const toMenu = () => {
      fireEvent.pointerMove(item("Focusing"), { pointerType: "mouse" });
      fireEvent.pointerLeave(item("Focusing"), { pointerType: "mouse" });
      expect(menu()).toHaveFocus();
    };
    toMenu();
    await user.keyboard("{ArrowLeft}");
    expect(item("Do not disturb")).toHaveFocus();
    toMenu();
    await user.keyboard("{ArrowRight}");
    expect(item("Available")).toHaveFocus();
  });

  it("jumps with Home and End", async () => {
    const user = userEvent.setup();
    renderPicker({ start: "FOCUSING" });
    await openWithKeyboard(user);
    await user.keyboard("{End}");
    expect(item("Do not disturb")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(item("Available")).toHaveFocus();
  });

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])(
    "picks with %s: calls onChange once, closes and returns focus to the trigger",
    async (_name, keys) => {
      const user = userEvent.setup();
      const onPick = vi.fn();
      renderPicker({ onPick });
      await openWithKeyboard(user);
      await user.keyboard("{ArrowRight}");
      await user.keyboard(keys);
      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick).toHaveBeenCalledWith("FOCUSING");
      await waitFor(() => {
        expect(screen.queryByRole("menu")).toBeNull();
      });
      expect(trigger()).toHaveFocus();
      expect(trigger()).toHaveAccessibleName(
        "Your availability: Focusing. Change",
      );
    },
  );

  it("picks with a click on an item", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderPicker({ onPick });
    await user.click(trigger());
    await screen.findByRole("menu");
    // jsdom puts every click on one point, so this pick is a press at the
    // opening press's place, which counts once REPEAT_WINDOW_MS has passed. In
    // a browser a choice lies somewhere else and the quarter second is enough.
    await new Promise((resolve) => setTimeout(resolve, REPEAT_WINDOW_MS + 20));
    await user.click(item("Do not disturb"));
    expect(onPick).toHaveBeenCalledWith("DO_NOT_DISTURB");
  });

  it.each(["FOCUSING", "DO_NOT_DISTURB"] as const)(
    "calls onChange for a repeat of %s, because it renews the 12 hours",
    async (current) => {
      const user = userEvent.setup();
      const onPick = vi.fn();
      renderPicker({ start: current, onPick });
      await openWithKeyboard(user);
      await user.keyboard("{Enter}");
      expect(onPick).toHaveBeenCalledWith(current);
    },
  );

  it("closes with Escape, and with a click outside, and calls nothing", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderPicker({ onPick });
    await openWithKeyboard(user);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(trigger()).toHaveFocus();
    await user.click(trigger());
    await screen.findByRole("menu");
    // The page behind is inert while the menu is open, so the press is sent straight to it.
    fireEvent.pointerDown(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(onPick).not.toHaveBeenCalled();
  });

  it("does nothing on a press while a save is in flight, and a key does not open it either", async () => {
    const user = userEvent.setup();
    renderPicker({ busy: true });
    expect(trigger()).toHaveAttribute("aria-busy", "true");
    expect(trigger()).not.toBeDisabled();
    await user.click(trigger());
    trigger().focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("menu")).toBeNull();
    // Tab still leaves it.
    await user.keyboard("{Tab}");
    expect(trigger()).not.toHaveFocus();
  });

  it("describes the menu, and not the trigger, by the hidden sentence, and is horizontal", async () => {
    const user = userEvent.setup();
    renderPicker();
    expect(trigger()).not.toHaveAttribute("aria-describedby");
    await user.click(trigger());
    await screen.findByRole("menu");
    expect(menu()).toHaveAccessibleDescription(
      "It goes back to Available after 12 hours.",
    );
    expect(menu()).toHaveAttribute("aria-orientation", "horizontal");
    // The sentence is hidden text: it is not in browse mode beside the trigger.
    const note = must(
      document.getElementById(must(menu().getAttribute("aria-describedby"))),
    );
    expect(note).toHaveAttribute("hidden");
  });

  it("marks the checked item by aria-checked and by its own inner border class state", async () => {
    const user = userEvent.setup();
    renderPicker({ start: "FOCUSING" });
    await user.click(trigger());
    await screen.findByRole("menu");
    const checked = within(menu())
      .getAllByRole("menuitemradio")
      .filter((el) => el.getAttribute("aria-checked") === "true");
    expect(checked.map((el) => el.dataset.value)).toEqual(["FOCUSING"]);
    expect(within(menu()).getAllByRole("menuitemradio")).toHaveLength(3);
  });

  it("keeps the words of every item, so the accessible name holds the visible words", async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(trigger());
    await screen.findByRole("menu");
    for (const name of ["Available", "Focusing", "Do not disturb"]) {
      expect(item(name)).toHaveAccessibleName(name);
    }
  });

  it("says it is saving in one permanent status node that is empty otherwise", () => {
    const quiet = renderPicker();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    quiet.unmount();
    renderPicker({ busy: true });
    expect(screen.getByRole("status")).toHaveTextContent(
      "Saving your availability",
    );
  });
});
