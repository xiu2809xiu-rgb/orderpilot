import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar";

function bar() {
  return screen.getByRole("progressbar", { name: "Progress for report.pdf" });
}

function fill(): HTMLElement {
  const found = bar().querySelector<HTMLElement>('[data-slot="progress-fill"]');
  if (!found) throw new Error("no fill");
  return found;
}

describe("ProgressBar", () => {
  it("is a progressbar with a name and a 0 to 100 range", () => {
    render(<ProgressBar value={40} label="Progress for report.pdf" />);
    expect(bar()).toHaveAttribute("aria-valuemin", "0");
    expect(bar()).toHaveAttribute("aria-valuemax", "100");
  });

  it("follows the value it is given, in the number and in the fill", () => {
    const { rerender } = render(
      <ProgressBar value={0} label="Progress for report.pdf" />,
    );
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
    expect(fill().style.width).toBe("0%");
    for (const value of [12, 40, 73, 100]) {
      rerender(<ProgressBar value={value} label="Progress for report.pdf" />);
      expect(bar()).toHaveAttribute("aria-valuenow", String(value));
      expect(fill().style.width).toBe(`${String(value)}%`);
    }
  });

  it("rounds to a whole percent", () => {
    render(<ProgressBar value={33.6} label="Progress for report.pdf" />);
    expect(bar()).toHaveAttribute("aria-valuenow", "34");
  });

  it("holds the value between 0 and 100", () => {
    const { rerender } = render(
      <ProgressBar value={-20} label="Progress for report.pdf" />,
    );
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
    expect(fill().style.width).toBe("0%");
    rerender(<ProgressBar value={250} label="Progress for report.pdf" />);
    expect(bar()).toHaveAttribute("aria-valuenow", "100");
    expect(fill().style.width).toBe("100%");
  });

  it("counts a value that is not a number as 0", () => {
    render(<ProgressBar value={Number.NaN} label="Progress for report.pdf" />);
    expect(bar()).toHaveAttribute("aria-valuenow", "0");
    expect(fill().style.width).toBe("0%");
  });

  it("never goes backwards: a smaller late reading leaves the fill where it was", () => {
    const { rerender } = render(
      <ProgressBar value={60} label="Progress for report.pdf" />,
    );
    rerender(<ProgressBar value={35} label="Progress for report.pdf" />);
    expect(bar()).toHaveAttribute("aria-valuenow", "60");
    expect(fill().style.width).toBe("60%");
    rerender(<ProgressBar value={80} label="Progress for report.pdf" />);
    expect(bar()).toHaveAttribute("aria-valuenow", "80");
  });

  it("glides between real values, and not at all under reduced motion", () => {
    render(<ProgressBar value={10} label="Progress for report.pdf" />);
    expect(fill()).toHaveClass(
      "transition-[width]",
      "duration-(--motion-fast)",
      "ease-(--ease-out)",
      "motion-reduce:transition-none",
    );
  });
});
