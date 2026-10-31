import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrollRegion } from "./ScrollRegion";

function setWidths(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(
    scrollWidth,
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    clientWidth,
  );
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
});
