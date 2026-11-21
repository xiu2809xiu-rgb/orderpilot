import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { HintTip } from "./HintTip";

// WCAG 2.2, 1.4.13: content shown on hover or focus can be pointed at, put
// away without moving focus, and stays until it is put away or left.

const WORDS = "Demo: ask a question";

// The tip is a lazy chunk: load it before the first test, so that test is not
// the one that pays for importing the tooltip library.
beforeAll(async () => {
  await import("./HintTipBody");
}, 60_000);

/** The tooltip's code is a chunk of its own, so the tip is found once it has arrived. */
async function tipBox(): Promise<HTMLElement> {
  await screen.findByRole("tooltip");
  const box = document.querySelector<HTMLElement>(
    "[data-slot=tooltip-content]",
  );
  if (!box) throw new Error("No tip");
  return box;
}

/** Longer than the grace the tip gives the pointer to cross onto it. */
const wait = (ms = 250) => new Promise((done) => setTimeout(done, ms));

function renderHint() {
  const user = userEvent.setup();
  render(
    <HintTip hint={WORDS}>
      <button type="button">Spark</button>
    </HintTip>,
  );
  return { user, button: screen.getByRole("button", { name: "Spark" }) };
}

describe("the tip of a top bar button", () => {
  it("stays open when the pointer moves from the button onto the tip", async () => {
    const { user, button } = renderHint();
    await user.hover(button);
    const box = await tipBox();
    await user.hover(box);
    await wait();
    expect(screen.getByRole("tooltip")).toHaveTextContent(WORDS);
  });

  it("stays open when the browser reports the tip entered before the button was left", async () => {
    const { user, button } = renderHint();
    await user.hover(button);
    const box = await tipBox();
    const wrapper = button.parentElement;
    if (!wrapper) throw new Error("No wrapper");
    // A real browser sends pointerout first: React reports the tip entered
    // from it, and the wrapper's own pointerleave comes after.
    fireEvent.pointerOut(button, { relatedTarget: box });
    // The testing library's fireEvent.pointerLeave is a pointerout, so this is sent by hand.
    act(() => {
      wrapper.dispatchEvent(new Event("pointerleave"));
    });
    await wait();
    expect(screen.getByRole("tooltip")).toHaveTextContent(WORDS);
  });

  it("puts itself away on Escape while focus stays on the button", async () => {
    const { user, button } = renderHint();
    await user.tab();
    expect(button).toHaveFocus();
    await tipBox();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("closes when the pointer leaves both the button and the tip", async () => {
    const { user, button } = renderHint();
    await user.hover(button);
    const box = await tipBox();
    await user.hover(box);
    await user.unhover(box);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("closes when the pointer leaves the button and never reaches the tip", async () => {
    const { user, button } = renderHint();
    await user.hover(button);
    await tipBox();
    await user.unhover(button);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("describes the button by its words, tip or no tip", () => {
    const { button } = renderHint();
    expect(button).toHaveAccessibleDescription(WORDS);
  });
});
