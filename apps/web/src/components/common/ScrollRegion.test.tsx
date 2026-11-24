import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { must } from "@/test/must";
import { ScrollRegion } from "./ScrollRegion";

function setWidths(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
    scrollWidth,
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    clientWidth,
  );
}

/** Moves a region's scroll position, as a finger or a wheel does, and tells it. */
function scrollTo(region: HTMLElement, left: number) {
  Object.defineProperty(region, "scrollLeft", {
    configurable: true,
    value: left,
  });
  fireEvent.scroll(region);
}

function renderWide(label = "Wide") {
  render(
    <ScrollRegion label={label}>
      <table />
    </ScrollRegion>,
  );
  return screen.getByRole("region", { name: label });
}

/** A ResizeObserver whose callback a test can call, as a browser does after a resize. */
function captureResizes() {
  const callbacks: (() => void)[] = [];
  class Captured {
    constructor(callback: () => void) {
      callbacks.push(callback);
    }
    observe() {
      // The test calls the callback itself.
    }
    unobserve() {
      // The test calls the callback itself.
    }
    disconnect() {
      // The test calls the callback itself.
    }
  }
  vi.stubGlobal("ResizeObserver", Captured);
  return () => {
    for (const callback of callbacks) callback();
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ScrollRegion", () => {
  it("takes a tab stop only when its content overflows", () => {
    setWidths(900, 300);
    render(
      <ScrollRegion label="Wide">
        <table />
      </ScrollRegion>,
    );
    expect(screen.getByRole("region", { name: "Wide" })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  it("adds no tab stop when everything fits", () => {
    setWidths(300, 300);
    render(
      <ScrollRegion label="Narrow">
        <table />
      </ScrollRegion>,
    );
    expect(screen.getByRole("region", { name: "Narrow" })).not.toHaveAttribute(
      "tabindex",
    );
  });

  describe("the edge marks", () => {
    it("marks neither side when the content fits", () => {
      setWidths(300, 300);
      const region = renderWide("Fits");
      expect(region).not.toHaveAttribute("data-more-start");
      expect(region).not.toHaveAttribute("data-more-end");
    });

    it("marks the right side only at the start", () => {
      setWidths(900, 300);
      const region = renderWide();
      expect(region).not.toHaveAttribute("data-more-start");
      expect(region).toHaveAttribute("data-more-end");
    });

    it("marks both sides in the middle", () => {
      setWidths(900, 300);
      const region = renderWide();
      scrollTo(region, 300);
      expect(region).toHaveAttribute("data-more-start");
      expect(region).toHaveAttribute("data-more-end");
    });

    it("marks the left side only at the end", () => {
      setWidths(900, 300);
      const region = renderWide();
      scrollTo(region, 600);
      expect(region).toHaveAttribute("data-more-start");
      expect(region).not.toHaveAttribute("data-more-end");
    });

    it("follows the scroll back to the start", () => {
      setWidths(900, 300);
      const region = renderWide();
      scrollTo(region, 600);
      scrollTo(region, 0);
      expect(region).not.toHaveAttribute("data-more-start");
      expect(region).toHaveAttribute("data-more-end");
    });

    it("follows a change of size with no scroll", () => {
      const resized = captureResizes();
      setWidths(300, 300);
      const region = renderWide();
      expect(region).not.toHaveAttribute("data-more-end");
      vi.restoreAllMocks();
      setWidths(900, 300);
      resized();
      expect(region).toHaveAttribute("data-more-end");
      expect(region).toHaveAttribute("tabindex", "0");
      vi.restoreAllMocks();
      setWidths(300, 300);
      resized();
      expect(region).not.toHaveAttribute("data-more-end");
      expect(region).not.toHaveAttribute("tabindex");
    });

    it("sizes the rail to the scroll area and the frames to the visible box", () => {
      setWidths(900, 300);
      const region = renderWide();
      const rail = must(region.querySelector<HTMLElement>(".sr-edges"));
      expect(rail.style.width).toBe("900px");
      expect(region.style.getPropertyValue("--sr-client-w")).toBe("300px");
    });

    it("measures the content, not its own rail, after the content shrinks", () => {
      // A real browser counts an absolute child in the scroll area: a rail
      // left at its old size would hold the area open at 900 px.
      const resized = captureResizes();
      let content = 900;
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
        300,
      );
      vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
        function (this: HTMLElement) {
          if (this.getAttribute("role") !== "region") return 0;
          const rail = this.querySelector<HTMLElement>(".sr-edges");
          return Math.max(
            content,
            Number.parseFloat(rail?.style.width ?? "") || 0,
          );
        },
      );
      const region = renderWide();
      const rail = must(region.querySelector<HTMLElement>(".sr-edges"));
      expect(rail.style.width).toBe("900px");
      content = 500;
      resized();
      expect(rail.style.width).toBe("500px");
      content = 300;
      resized();
      expect(rail.style.width).toBe("300px");
      expect(region).not.toHaveAttribute("data-more-end");
      expect(region).not.toHaveAttribute("tabindex");
    });

    it("measures the box, not the old size of its own frames, after the window narrows", () => {
      // The frames are as wide as the visible box, so a browser counts them
      // in the scroll area too: left at 600 px they would make a box that is
      // now 300 px wide, holding 250 px of content, look as if it overflowed.
      const resized = captureResizes();
      let client = 600;
      vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(
        function (this: HTMLElement) {
          return this.getAttribute("role") === "region" ? client : 0;
        },
      );
      vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(
        function (this: HTMLElement) {
          if (this.getAttribute("role") !== "region") return 0;
          const rail = this.querySelector<HTMLElement>(".sr-edges");
          const frames =
            Number.parseFloat(this.style.getPropertyValue("--sr-client-w")) ||
            0;
          const railWidth = Number.parseFloat(rail?.style.width ?? "") || 0;
          return Math.max(250, client, frames, railWidth);
        },
      );
      const region = renderWide();
      expect(region.style.getPropertyValue("--sr-client-w")).toBe("600px");
      client = 300;
      resized();
      expect(region.style.getPropertyValue("--sr-client-w")).toBe("300px");
      expect(region).not.toHaveAttribute("data-more-end");
      expect(region).not.toHaveAttribute("tabindex");
    });

    it("keeps the content first, the rail last and hidden from screen readers", () => {
      setWidths(900, 300);
      const region = renderWide();
      expect(region.children).toHaveLength(2);
      expect(must(region.firstElementChild).tagName).toBe("TABLE");
      const rail = must(region.lastElementChild);
      expect(rail).toHaveClass("sr-edges");
      expect(rail).toHaveAttribute("aria-hidden", "true");
      expect(rail.textContent).toBe("");
      expect(Array.from(rail.children).map((frame) => frame.className)).toEqual(
        ["sr-edge sr-edge-start", "sr-edge sr-edge-end"],
      );
    });

    it("adds no tab stop and no name of its own", () => {
      setWidths(900, 300);
      const region = renderWide();
      const rail = must(region.lastElementChild);
      expect(rail).not.toHaveAttribute("tabindex");
      expect(rail).not.toHaveAttribute("role");
      expect(screen.getAllByRole("region")).toHaveLength(1);
    });

    it("stops listening to the scroll when it is removed", () => {
      setWidths(900, 300);
      const remove = vi.spyOn(HTMLElement.prototype, "removeEventListener");
      const { unmount } = render(
        <ScrollRegion label="Gone">
          <table />
        </ScrollRegion>,
      );
      unmount();
      expect(remove.mock.calls.map(([type]) => type)).toContain("scroll");
    });

    it("has no accessibility violation", async () => {
      setWidths(900, 300);
      const { container } = render(
        <ScrollRegion label="Wide">
          <table>
            <caption>Rows</caption>
            <tbody>
              <tr>
                <td>One</td>
              </tr>
            </tbody>
          </table>
        </ScrollRegion>,
      );
      expect(await axeViolations(container)).toEqual([]);
    });
  });
});
