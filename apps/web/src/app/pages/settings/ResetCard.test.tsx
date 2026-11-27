import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import { sessionFor } from "@/test/fixtures";
import { ResetCard } from "./ResetCard";
import { loadSettingsWords, renderSettings } from "./settingsTestKit";

beforeAll(loadSettingsWords);

afterEach(() => {
  localStorage.clear();
  useToastStore.setState({ items: [] });
});

// The first two cases were in LayoutCard.test.tsx, where the reset row was
// before it moved to the last group.
describe("the Reset group", () => {
  const mine = `op.table.orders.${sessionFor("SUPPORT").user.id}`;

  it("forgets this person's layouts only, then Undo puts them back", async () => {
    localStorage.setItem(mine, '{"hidden":["a"]}');
    localStorage.setItem("op.table.orders.someone-else", '{"hidden":["b"]}');
    localStorage.setItem("op-theme", "dark");
    renderSettings(<ResetCard />);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(localStorage.getItem(mine)).toBeNull();
    expect(localStorage.getItem("op.table.orders.someone-else")).toBe(
      '{"hidden":["b"]}',
    );
    expect(localStorage.getItem("op-theme")).toBe("dark");
    const toast = useToastStore.getState().items.at(-1);
    expect(toast?.message).toBe("Saved table layouts reset.");
    expect(toast?.undo).toBeTypeOf("function");
    await act(async () => {
      await toast?.undo?.();
    });
    expect(localStorage.getItem(mine)).toBe('{"hidden":["a"]}');
  });

  it("says so when nothing was saved, and offers no Undo", async () => {
    renderSettings(<ResetCard />);
    await userEvent.click(screen.getByRole("button", { name: "Reset" }));
    const toast = useToastStore.getState().items.at(-1);
    expect(toast?.message).toBe("There were no saved table layouts.");
    expect(toast?.undo).toBeUndefined();
  });

  it("keeps focus on the button after the reset, as before", async () => {
    localStorage.setItem(mine, '{"hidden":["a"]}');
    renderSettings(<ResetCard />);
    const button = screen.getByRole("button", { name: "Reset" });
    await userEvent.click(button);
    expect(button).toHaveFocus();
  });

  it("is a quiet destructive outline with its icon, like Sign out", () => {
    renderSettings(<ResetCard />);
    const button = screen.getByRole("button", { name: "Reset" });
    expect(button).toHaveAttribute("data-variant", "outline");
    expect(button).toHaveClass("border-destructive", "text-destructive");
    expect(button).toHaveClass("dark:border-destructive", "dark:bg-background");
    expect(button).not.toHaveClass("dark:bg-input/30");
    expect(button).not.toHaveClass("bg-destructive");
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is headed Reset, and the button is described by the row's line", () => {
    renderSettings(<ResetCard />);
    expect(screen.getByRole("heading", { name: "Reset" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reset" }),
    ).toHaveAccessibleDescription(
      "The columns, their order and the views you saved in lists.",
    );
  });
});
