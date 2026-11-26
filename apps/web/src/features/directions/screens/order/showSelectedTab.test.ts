import { describe, expect, it } from "vitest";
import { showSelectedTab } from "./showSelectedTab";

/** jsdom lays nothing out, so the rectangles are the test's to give. */
function row(edge: [number, number], tab: [number, number], scrollLeft = 100) {
  const list = document.createElement("div");
  const selected = document.createElement("button");
  selected.setAttribute("role", "tab");
  selected.setAttribute("aria-selected", "true");
  const other = document.createElement("button");
  other.setAttribute("role", "tab");
  other.setAttribute("aria-selected", "false");
  list.append(other, selected);
  const rect = ([left, right]: [number, number]) =>
    ({ left, right, top: 0, bottom: 44, width: right - left }) as DOMRect;
  list.getBoundingClientRect = () => rect(edge);
  selected.getBoundingClientRect = () => rect(tab);
  list.scrollLeft = scrollLeft;
  return list;
}

describe("showSelectedTab", () => {
  it("slides the row left until a selected tab on its right edge shows", () => {
    const list = row([46, 352], [429, 509]);
    showSelectedTab(list);
    expect(list.scrollLeft).toBe(100 + (509 - 352));
  });

  it("slides the row back until a selected tab past its left edge shows", () => {
    const list = row([46, 352], [-40, 40]);
    showSelectedTab(list);
    expect(list.scrollLeft).toBe(100 - (46 + 40));
  });

  it("leaves the row where it is when the selected tab already shows", () => {
    const list = row([46, 352], [60, 140]);
    showSelectedTab(list);
    expect(list.scrollLeft).toBe(100);
  });

  it("does nothing when no tab is selected or there is no row", () => {
    showSelectedTab(null);
    const list = document.createElement("div");
    list.scrollLeft = 7;
    showSelectedTab(list);
    expect(list.scrollLeft).toBe(7);
  });
});
