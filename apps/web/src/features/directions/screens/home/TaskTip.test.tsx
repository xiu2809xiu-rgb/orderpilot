import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  loadHomeNamespaces,
  makeTask,
  renderHome,
  serveHome,
} from "./homeTestKit";
import { TaskTip } from "./TaskTip";

// A sighted person is told what a task button records, and what it does not
// do, by a tip on hover and on keyboard focus. A screen reader hears the same
// line as the button's description, once.

const LINE = "Records that this is done. OrderPilot sends nothing.";

// The tip is a lazy chunk: load it before the first test.
beforeAll(async () => {
  await loadHomeNamespaces();
  await import("@/app/shell/HintTipBody");
}, 60_000);

afterEach(() => {
  vi.unstubAllGlobals();
});

const PACK = makeTask({
  kind: "PACK_ORDER",
  assigneeRole: "WAREHOUSE",
  orderNo: "SO-0801",
});

describe("the tip of a task button on Home", () => {
  it("shows the line on hover, and puts it away when the pointer leaves", async () => {
    const user = userEvent.setup();
    serveHome({ tasks: [PACK] });
    renderHome("WAREHOUSE");
    const button = await screen.findByRole("button", {
      name: "Mark as packed for SO-0801",
    });
    expect(screen.queryByRole("tooltip")).toBeNull();
    await user.hover(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LINE);
    await user.unhover(button);
    await waitFor(() => {
      expect(screen.queryByRole("tooltip")).toBeNull();
    });
  });

  it("shows the line on keyboard focus, and Escape puts it away while focus stays", async () => {
    const user = userEvent.setup();
    serveHome({ tasks: [PACK] });
    renderHome("WAREHOUSE");
    const button = await screen.findByRole("button", {
      name: "Mark as packed for SO-0801",
    });
    // Home has links before the button; focus lands on it as Tab would.
    act(() => {
      button.focus();
    });
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LINE);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("leaves the description a screen reader hears as it was: the line, once", async () => {
    const user = userEvent.setup();
    serveHome({ tasks: [PACK] });
    renderHome("WAREHOUSE");
    const button = await screen.findByRole("button", {
      name: "Mark as packed for SO-0801",
    });
    expect(button).toHaveAccessibleDescription(LINE);
    const before = button.getAttribute("aria-describedby");
    await user.hover(button);
    await screen.findByRole("tooltip");
    expect(button.getAttribute("aria-describedby")).toBe(before);
    expect(button).toHaveAccessibleDescription(LINE);
    // The tooltip library renders a visually hidden copy of the line for its
    // own role, which the top bar's HintTip accepts too; it is not the
    // button's description. What this guards is that description and the
    // button's aria-describedby, unchanged while the tip is open. The button's
    // own text is the one sr-only line.
    expect(
      screen.getAllByText(LINE, { selector: "span.sr-only" }),
    ).toHaveLength(1);
  });

  it("is the button's own box: the row gets no extra element in its layout", async () => {
    serveHome({ tasks: [PACK] });
    renderHome("WAREHOUSE");
    const button = await screen.findByRole("button", {
      name: "Mark as packed for SO-0801",
    });
    const wrapper = button.parentElement;
    expect(wrapper?.tagName).toBe("SPAN");
    expect(wrapper?.className).toContain("relative");
    expect(wrapper?.className).toContain("sm:w-auto");
    // Only the button, and the tip's anchor: an overlay that takes no space and no click.
    await waitFor(() => {
      expect(wrapper?.children).toHaveLength(2);
    });
    expect(wrapper?.children[0]).toBe(button);
    expect(wrapper?.children[1]?.className).toContain("pointer-events-none");
    expect(wrapper?.children[1]?.className).toContain("absolute");
  });

  it("gives a link with no line of its own no tip and no wrapper", async () => {
    serveHome({
      tasks: [
        makeTask({
          kind: "REVIEW_FIELDS",
          assigneeRole: "SUPPORT",
          orderNo: "SO-0802",
        }),
      ],
    });
    renderHome("SUPPORT");
    const link = await screen.findByRole("link", { name: /for SO-0802/ });
    expect(link.parentElement?.tagName).not.toBe("SPAN");
  });
});

describe("one tip whose button gains a line of its own", () => {
  function Slot({ enabled }: { enabled: boolean }) {
    return (
      <TaskTip hint={LINE} enabled={enabled}>
        <button type="button">Pay now</button>
      </TaskTip>
    );
  }

  it("shows the line on hover once it is enabled, on the same instance", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Slot enabled={false} />);
    rerender(<Slot enabled />);
    await user.hover(screen.getByRole("button", { name: "Pay now" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LINE);
  });

  it("shows the line on keyboard focus once it is enabled, on the same instance", async () => {
    const { rerender } = render(<Slot enabled={false} />);
    rerender(<Slot enabled />);
    const button = screen.getByRole("button", { name: "Pay now" });
    act(() => {
      button.focus();
    });
    expect(await screen.findByRole("tooltip")).toHaveTextContent(LINE);
  });
});

describe("on a touch screen", () => {
  it("shows no tip: the first tap does the task", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("pointer: coarse"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const user = userEvent.setup();
    render(
      <TaskTip hint={LINE}>
        <button type="button">Mark as packed</button>
      </TaskTip>,
    );
    const button = screen.getByRole("button", { name: "Mark as packed" });
    await user.hover(button);
    await user.tab();
    expect(button).toHaveFocus();
    await new Promise((done) => setTimeout(done, 200));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
