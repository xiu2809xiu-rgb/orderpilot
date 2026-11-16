import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "@/test/render";

vi.mock("@/components/kit/DepthField", () => ({
  DepthField: ({ paused }: { paused?: boolean }) => (
    <div data-testid="scene" data-paused={String(paused)} />
  ),
}));

vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

describe("the Pause button on the hero stage", () => {
  it("is named for what it does, and holds every moving thing on the page", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: false });
    const pause = await screen.findByRole("button", {
      name: "Pause the hero animation",
    });
    expect(
      screen.getByRole("group", { name: "Animated preview of OrderPilot" }),
    ).toContainElement(pause);
    expect(document.documentElement).not.toHaveAttribute("data-signin-paused");

    await user.click(pause);
    const play = screen.getByRole("button", {
      name: "Play the hero animation",
    });
    expect(document.documentElement).toHaveAttribute("data-signin-paused");
    expect(await screen.findByTestId("scene")).toHaveAttribute(
      "data-paused",
      "true",
    );

    await user.click(play);
    expect(
      screen.getByRole("button", { name: "Pause the hero animation" }),
    ).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute("data-signin-paused");
  });

  it("can be reached by keyboard and works with Enter", async () => {
    const user = userEvent.setup();
    renderApp("/login", { demoMode: false });
    const pause = await screen.findByRole("button", {
      name: "Pause the hero animation",
    });
    pause.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("button", { name: "Play the hero animation" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
  });
});
