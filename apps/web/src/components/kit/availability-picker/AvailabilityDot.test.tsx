import { PERSON_AVAILABILITIES } from "@orderpilot/shared";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { must } from "@/test/must";
import { AvailabilityDot } from "./AvailabilityDot";

describe("the availability dot", () => {
  it.each(PERSON_AVAILABILITIES)("draws the mark of %s", (value) => {
    const { container } = render(<AvailabilityDot value={value} />);
    const dot = must(container.querySelector(".ap-dot"));
    expect(dot).toHaveAttribute("data-value", value);
    expect(dot.querySelectorAll("svg.ap-mark")).toHaveLength(1);
  });

  it("draws a different silhouette for each value", () => {
    const shapes = PERSON_AVAILABILITIES.map((value) => {
      const { container, unmount } = render(<AvailabilityDot value={value} />);
      const html = must(container.querySelector("svg")).innerHTML;
      unmount();
      return html;
    });
    expect(new Set(shapes).size).toBe(3);
  });

  it("is hidden from assistive technology and holds no text", () => {
    const { container } = render(<AvailabilityDot value="DO_NOT_DISTURB" />);
    const dot = must(container.querySelector(".ap-dot"));
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot.textContent).toBe("");
  });

  it("asks for a 1.75 px stroke that does not scale with the mark", () => {
    const { container } = render(<AvailabilityDot value="AVAILABLE" />);
    const mark = must(container.querySelector("svg"));
    expect(mark).toHaveAttribute("stroke-width", "1.75");
    expect(mark).toHaveClass("lucide");
  });
});
