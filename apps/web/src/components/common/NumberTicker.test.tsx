import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NumberTicker } from "./NumberTicker";

describe("NumberTicker", () => {
  it("groups thousands, as the figure reads everywhere else", () => {
    render(<NumberTicker value={2046} />);
    // The drawn digits and the text a screen reader gets.
    expect(screen.getAllByText("2,046")).toHaveLength(2);
  });

  it("keeps the decimals of a figure and groups its integer part", () => {
    render(<NumberTicker value={12345.5} />);
    expect(screen.getAllByText("12,345.5")).toHaveLength(2);
  });

  it("leaves a small figure as it is", () => {
    render(<NumberTicker value={22} />);
    expect(screen.getAllByText("22")).toHaveLength(2);
  });
});
