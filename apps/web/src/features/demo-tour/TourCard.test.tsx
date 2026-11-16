import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "@/test/axe";
import { TourCard } from "./TourCard";

function card(overrides: Partial<Parameters<typeof TourCard>[0]> = {}) {
  const props = {
    index: 2,
    total: 16,
    stepId: "review",
    advance: "click" as const,
    nextReady: true,
    missing: false,
    busy: false,
    last: false,
    switchTo: null,
    puttingBack: false,
    onNext: vi.fn(),
    onEnd: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<TourCard {...props} />) };
}

describe("the demo tour's card", () => {
  it("on a click step says which step, what it shows, and to click the lit button, with no Next", async () => {
    const { container } = card();
    expect(screen.getByText("Step 3 of 16")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Support checks what the AI read" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Click the lit button to go on."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("on a next step holds Next until the step is ready", () => {
    card({ stepId: "comment", advance: "next", nextReady: false });
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("offers to skip a button that never appeared", async () => {
    const { props } = card({ missing: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Skip this step" }),
    );
    expect(props.onNext).toHaveBeenCalled();
  });

  it("finishes on the last step, and can be ended at any step", async () => {
    const { props } = card({ stepId: "finish", advance: "next", last: true });
    await userEvent.click(
      screen.getByRole("button", { name: "Finish and put the data back" }),
    );
    expect(props.onNext).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "End tour" }));
    expect(props.onEnd).toHaveBeenCalled();
  });

  it("asks the presenter to switch role before another team's step, with nothing else to press", () => {
    card({ switchTo: "Support", advance: "next" });
    expect(
      screen.getByRole("heading", { name: "Switch to Support" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Open Demo role at the top right and choose Support/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByText("Click the lit button to go on.")).toBeNull();
  });

  it("says to wait while it puts the last team's actions back", () => {
    card({ switchTo: "Support", puttingBack: true });
    expect(
      screen.getByText(/Putting back what this team did/),
    ).toBeInTheDocument();
  });
});
