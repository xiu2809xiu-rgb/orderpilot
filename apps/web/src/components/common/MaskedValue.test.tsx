import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { MaskedValue } from "./MaskedValue";

// The mask on the master-data pages behaves as the one on the order pages:
// the reason shows on hover and on focus, a click or a tap keeps it, and a
// second one, Escape or a Tab away puts it away.

const REASON = "Bank details are hidden unless your role handles payments.";

beforeAll(async () => {
  await i18n.loadNamespaces(["components"]);
});

function lock() {
  return screen.getByRole("button", { name: "Why is this hidden?" });
}

function show() {
  return render(
    <div>
      <MaskedValue reason="bankDetails" visibleTo="Finance" />
      <button type="button">Next control</button>
    </div>,
  );
}

describe("the mask of the master-data pages", () => {
  it("shows the reason, the title and who may see it on hover alone, with no click", async () => {
    const user = userEvent.setup();
    show();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.hover(lock());
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Why this is hidden");
    expect(tip).toHaveTextContent(REASON);
    expect(tip).toHaveTextContent("Who can see it: Finance");
  });

  it("shows the reason on keyboard focus alone, with no click", async () => {
    const user = userEvent.setup();
    show();
    await user.tab();
    expect(lock()).toHaveFocus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(REASON);
  });

  it("is not a dialog: focus stays on the lock, and Tab moves on and closes a pinned reason", async () => {
    const user = userEvent.setup();
    show();
    await user.tab();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("tooltip")).toHaveTextContent(REASON);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(lock()).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Next control" })).toHaveFocus();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps the reason after a tap and puts it away on a second tap", async () => {
    show();
    fireEvent.click(lock());
    expect(await screen.findByRole("tooltip")).toHaveTextContent(REASON);
    fireEvent.click(lock());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("puts a pinned reason away on Escape and on a press elsewhere", async () => {
    const user = userEvent.setup();
    show();
    fireEvent.click(lock());
    await screen.findByRole("tooltip");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(lock());
    await screen.findByRole("tooltip");
    fireEvent.pointerDown(screen.getByRole("button", { name: "Next control" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("keeps its words and never puts the value in the page", () => {
    const { container } = render(
      <MaskedValue value="000000000007" reason="price" />,
    );
    expect(container).not.toHaveTextContent("000000000007");
    expect(screen.getByLabelText("Hidden")).toBeInTheDocument();
    expect(lock()).toBeInTheDocument();
  });
});
