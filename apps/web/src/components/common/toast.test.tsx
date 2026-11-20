import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { must } from "@/test/must";
import { axeViolations } from "@/test/axe";
import { toast, useToastStore } from "./toast";
import { Toaster } from "./Toaster";

afterEach(() => {
  vi.useRealTimers();
  useToastStore.setState({ items: [] });
});

const polite = () =>
  must(document.querySelector<HTMLElement>('[aria-live="polite"]'));
const assertive = () =>
  must(document.querySelector<HTMLElement>('[aria-live="assertive"]'));

describe("toast", () => {
  it("announces a finished action politely, without taking focus", async () => {
    render(<Toaster />);
    // The listening region is there before the message, so it is announced.
    const status = polite();
    expect(status).toBeEmptyDOMElement();
    act(() => {
      toast.done("SPR-1042 approved", { description: "Comment saved" });
    });
    expect(status).toHaveTextContent("SPR-1042 approved");
    expect(status).toHaveTextContent("Comment saved");
    expect(document.body).toHaveFocus();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("announces a failure as an alert, and keeps it until it is closed", async () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.failed("The change was not saved");
    });
    expect(assertive()).toHaveTextContent("The change was not saved");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(assertive()).toHaveTextContent("The change was not saved");
    vi.useRealTimers();
    await userEvent.click(
      screen.getByRole("button", { name: "Close message" }),
    );
    expect(assertive()).toBeEmptyDOMElement();
  });

  it("leaves on its own after a few seconds", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      toast.done("Saved");
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(6_100);
    });
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("offers Undo only where the caller passes an undo function", async () => {
    render(<Toaster />);
    act(() => {
      toast.done("No undo here");
    });
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    const undo = vi.fn();
    act(() => {
      toast.done("Disabled Synthetic Person", { undo });
    });
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
    // Undoing is an action too, so it ends with its own message.
    expect(await screen.findByText("Undone")).toBeInTheDocument();
    expect(screen.queryByText("Disabled Synthetic Person")).toBeNull();
  });

  it("undoes the latest toast from the keyboard, away from the toast", async () => {
    render(
      <>
        <button type="button">Before</button>
        <input aria-label="Field" />
        <Toaster />
      </>,
    );
    const undo = vi.fn();
    act(() => {
      toast.done("Disabled Synthetic Person", { undo });
    });
    // Typing in a field keeps the browser's own undo.
    await userEvent.click(screen.getByRole("textbox", { name: "Field" }));
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(undo).not.toHaveBeenCalled();
    screen.getByRole("textbox", { name: "Field" }).blur();
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(undo).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Undone")).toBeInTheDocument();
    expect(screen.queryByText("Disabled Synthetic Person")).toBeNull();
  });

  it("returns focus to where the person was when Undo is pressed", async () => {
    render(
      <>
        <button type="button">Disable</button>
        <main id="main" tabIndex={-1} />
        <Toaster />
      </>,
    );
    act(() => {
      toast.done("Disabled", { undo: () => undefined });
    });
    const origin = screen.getByRole("button", { name: "Disable" });
    origin.focus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: /Undo/ })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await screen.findByText("Undone");
    expect(origin).toHaveFocus();
  });

  it("says so when Undo fails", async () => {
    render(<Toaster />);
    act(() => {
      toast.done("Disabled", {
        undo: () => Promise.reject(new Error("no")),
      });
    });
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => {
      expect(assertive()).toHaveTextContent("Could not undo");
    });
  });

  it("offers a link beside Undo only where the caller passes an action", async () => {
    render(
      <MemoryRouter>
        <Toaster />
        <Routes>
          <Route path="/" element={<p>Start</p>} />
          <Route path="/orders/:no" element={<p>The order page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    act(() => {
      toast.done("Marked SO-0049 as packed");
    });
    expect(screen.queryByRole("link", { name: "Open order" })).toBeNull();

    const undo = vi.fn();
    act(() => {
      toast.done("Marked SO-0050 as packed", {
        undo,
        action: { label: "Open order", to: "/orders/SO-0050" },
      });
    });
    const link = screen.getByRole("link", { name: "Open order" });
    expect(link).toHaveAttribute("href", "/orders/SO-0050");
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(await axeViolations(document.body)).toEqual([]);

    await userEvent.click(link);
    expect(await screen.findByText("The order page")).toBeInTheDocument();
    // Going to the order closes the message, and Undo was not pressed.
    expect(screen.queryByText("Marked SO-0050 as packed")).toBeNull();
    expect(undo).not.toHaveBeenCalled();
  });

  it("shows at most three at once", () => {
    render(<Toaster />);
    act(() => {
      for (const n of [1, 2, 3, 4]) toast.done(`Message ${String(n)}`);
    });
    expect(screen.queryByText("Message 1")).toBeNull();
    expect(screen.getByText("Message 4")).toBeInTheDocument();
  });
});
