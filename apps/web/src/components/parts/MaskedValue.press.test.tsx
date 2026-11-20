import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { MaskedValue } from "./MaskedValue";

// A touch screen has no hover and no focus ring: a tap is the only way to ask
// why a figure is hidden, so it must show the reason and keep it.

const REASON = "Hidden: Prices are hidden from Warehouse";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-parts"]);
});

function mask() {
  return screen.getByRole("button", { name: /Hidden/ });
}

describe("MaskedValue pressed", () => {
  it("shows its reason on a tap and keeps it until a second tap", async () => {
    render(<MaskedValue masked reason="Prices are hidden from Warehouse" />);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.click(mask());
    expect(await screen.findByRole("tooltip")).toHaveTextContent(REASON);
    fireEvent.click(mask());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows it on a mouse click, and a second click puts it away", async () => {
    const user = userEvent.setup();
    render(<MaskedValue masked reason="Prices are hidden from Warehouse" />);
    await user.click(mask());
    expect(await screen.findByRole("tooltip")).toHaveTextContent(REASON);
    await user.click(mask());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("puts the reason away on Escape", async () => {
    const user = userEvent.setup();
    render(<MaskedValue masked reason="Prices are hidden from Warehouse" />);
    fireEvent.click(mask());
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("puts the reason away when the person taps elsewhere", async () => {
    render(
      <div>
        <MaskedValue masked reason="Prices are hidden from Warehouse" />
        <p>Somewhere else</p>
      </div>,
    );
    fireEvent.click(mask());
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    fireEvent.pointerDown(screen.getByText("Somewhere else"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("still shows the reason on keyboard focus", async () => {
    const user = userEvent.setup();
    render(<MaskedValue masked reason="Prices are hidden from Warehouse" />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(REASON);
  });
});
