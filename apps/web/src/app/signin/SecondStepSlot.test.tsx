import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { SecondStepSlot } from "./SecondStepSlot";

// The chunk of the second step cannot be loaded, as after a stale deploy.
vi.mock("./TwoStepStep", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

beforeAll(async () => {
  await i18n.loadNamespaces(["signin", "common"]);
});
afterEach(() => {
  vi.restoreAllMocks();
});

function renderSlot(onBack = vi.fn()) {
  // React reports a caught render error on the console.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(
    <SecondStepSlot
      idPrefix="signin"
      onVerified={vi.fn()}
      onEnded={vi.fn()}
      onBack={onBack}
    />,
  );
  return onBack;
}

describe("the second step's slot when its chunk fails to load", () => {
  it("says so in plain words, with no trace id and no crash screen", async () => {
    renderSlot();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The second step could not be loaded. Check your connection, go back and sign in again.",
    );
    expect(alert).not.toHaveTextContent("Trace");
  });

  it("goes back to the password form with Back to sign in", async () => {
    const onBack = renderSlot();
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "Back to sign in" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
