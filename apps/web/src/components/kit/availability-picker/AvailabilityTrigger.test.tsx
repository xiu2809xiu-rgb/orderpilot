import { PERSON_AVAILABILITIES } from "@orderpilot/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { must } from "@/test/must";
import { AvailabilityTrigger } from "./AvailabilityTrigger";

describe("the availability trigger", () => {
  it.each(PERSON_AVAILABILITIES)(
    "names itself with the value in words for %s",
    (value) => {
      render(
        <AvailabilityTrigger
          value={value}
          label={`Your availability: ${value}. Change`}
        />,
      );
      const button = screen.getByRole("button");
      expect(button).toHaveAccessibleName(
        `Your availability: ${value}. Change`,
      );
      expect(button).toHaveAttribute("data-value", value);
    },
  );

  it("draws the dot skin without a ring, and the ring skin with one", () => {
    const { container, rerender } = render(
      <AvailabilityTrigger value="FOCUSING" label="x" />,
    );
    expect(container.querySelector(".ap-ring")).toBeNull();
    expect(screen.getByRole("button")).toHaveAttribute("data-skin", "dot");
    rerender(<AvailabilityTrigger value="FOCUSING" label="x" skin="ring" />);
    expect(container.querySelector(".ap-ring")).not.toBeNull();
    expect(screen.getByRole("button")).toHaveAttribute("data-skin", "ring");
  });

  it("is busy without being disabled, so focus can come back to it", () => {
    render(<AvailabilityTrigger value="AVAILABLE" label="x" busy />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).not.toBeDisabled();
  });

  it("hides its picture from assistive technology: the name is on the button", () => {
    const { container } = render(
      <AvailabilityTrigger value="AVAILABLE" label="x" />,
    );
    expect(must(container.querySelector(".ap-face"))).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("plays the pulse and the sheen once for a new pick, and not for one it appeared with", () => {
    const { container, rerender } = render(
      <AvailabilityTrigger value="AVAILABLE" label="x" pulse={3} />,
    );
    expect(container.querySelectorAll(".ap-sheen")).toHaveLength(0);
    rerender(<AvailabilityTrigger value="FOCUSING" label="x" pulse={4} />);
    expect(container.querySelectorAll(".ap-sheen")).toHaveLength(1);
    expect(container.querySelectorAll(".ap-pulse")).toHaveLength(1);
  });
});
