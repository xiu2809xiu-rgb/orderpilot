import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TourOverlay } from "./TourOverlay";

const box = (left: number, top: number, width: number, height: number) =>
  new DOMRect(left, top, width, height);

function card(): HTMLElement {
  const found = document.querySelector<HTMLElement>(".dx-tour-card");
  if (!found) throw new Error("no card");
  return found;
}

describe("where the tour's card goes", () => {
  it("sits under a lit button near the top of the screen", () => {
    render(
      <TourOverlay rect={box(1200, 20, 110, 40)} menu={null}>
        words
      </TourOverlay>,
    );
    expect(card().style.top).not.toBe("");
    expect(card().style.right).toBe("");
  });

  it("steps to the left of an open menu, keeping the list clear", () => {
    window.innerWidth = 1440;
    render(
      <TourOverlay rect={box(1200, 20, 110, 40)} menu={box(1150, 70, 256, 420)}>
        words
      </TourOverlay>,
    );
    expect(card().style.top).toBe("70px");
    expect(card().style.right).toBe(`${String(1440 - 1150 + 16)}px`);
  });

  it("goes to the bottom left corner when there is no room beside the menu", () => {
    render(
      <TourOverlay rect={null} menu={box(200, 70, 256, 420)}>
        words
      </TourOverlay>,
    );
    expect(card().style.left).toBe("16px");
    expect(card().style.bottom).toBe("16px");
  });
});
