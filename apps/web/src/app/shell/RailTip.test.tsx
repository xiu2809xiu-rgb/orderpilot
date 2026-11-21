import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RailTip } from "./RailTip";

function rail(show = true) {
  return render(
    <RailTip show={show} tip={<span>Orders</span>}>
      <a href="/orders">
        <span className="sr-only">Orders</span>
      </a>
    </RailTip>,
  );
}

/** The tooltip's code is a chunk: until it arrives the row is shown without one. */
async function readyLink() {
  await waitFor(() => {
    expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
      "data-slot",
      "tooltip-trigger",
    );
  });
  return screen.getByRole("link", { name: "Orders" });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the name of a rail icon", () => {
  it("shows on keyboard focus and goes away on Escape", async () => {
    const user = userEvent.setup();
    rail();
    await readyLink();
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Orders");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows when the pointer rests on the icon", async () => {
    const user = userEvent.setup();
    rail();
    await user.hover(await readyLink());
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Orders");
  });

  it("shows on a touch press and stays through the tap's click", async () => {
    rail();
    const link = await readyLink();
    fireEvent.pointerDown(link, { pointerType: "touch" });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Orders");
    fireEvent.pointerUp(link, { pointerType: "touch" });
    fireEvent.click(link);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("lets go of a touch's name after a moment", async () => {
    rail();
    const link = await readyLink();
    vi.useFakeTimers();
    fireEvent.pointerDown(link, { pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("puts a touch's name away on Escape without waiting", async () => {
    rail();
    const link = await readyLink();
    fireEvent.pointerDown(link, { pointerType: "touch" });
    await screen.findByRole("tooltip");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("is not there at all when the panel is open", () => {
    rail(false);
    expect(screen.getByRole("link", { name: "Orders" })).toBeVisible();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
