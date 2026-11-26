import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

function block(container: HTMLElement): Element {
  const found = container.querySelector('[data-slot="skeleton"]');
  if (!found) throw new Error("no skeleton block");
  return found;
}

describe("Skeleton", () => {
  it("shimmers with the band of styles/motion.css and no longer pulses", () => {
    const { container } = render(<Skeleton className="h-8" />);
    const el = block(container);
    expect(el).toHaveClass("dx-shimmer", "h-8", "bg-accent");
    expect(el).not.toHaveClass("animate-pulse");
    expect(el).not.toHaveClass("animate-none");
  });

  it("is a still grey block when it is `still`, with no band at all", () => {
    const { container } = render(<Skeleton still />);
    const el = block(container);
    expect(el).not.toHaveClass("dx-shimmer");
    expect(el).not.toHaveClass("animate-pulse");
    expect(el).toHaveClass("animate-none", "bg-accent");
  });

  it("passes its other props on and keeps its slot", () => {
    const { container } = render(<Skeleton aria-hidden="true" data-x="1" />);
    expect(block(container)).toHaveAttribute("aria-hidden", "true");
    expect(block(container)).toHaveAttribute("data-x", "1");
  });
});
