import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { axeViolations } from "@/test/axe";
import {
  codesAnswer,
  loadTwoStepWords,
  OFF,
  ON,
  record,
  renderCard,
  serveStatus,
  serveStatusError,
  setupAnswer,
} from "./twoStepTestKit";

beforeAll(loadTwoStepWords);

const LOCKED = "2026-11-22T03:00:00.000Z";

describe("the two-step card for a screen reader", () => {
  it.each([
    ["off", OFF],
    ["on", ON],
    ["on with few codes left", { ...ON, recoveryCodesLeft: 1 }],
    ["with a recent lock", { ...OFF, lastLockedAt: LOCKED }],
    ["for an account with no password", { ...OFF, hasPassword: false }],
    [
      "for a demo session on an account that cannot be undone",
      { ...OFF, demoAdminBlocked: true },
    ],
  ])("has no accessibility violations %s", async (_name, status) => {
    serveStatus(status);
    const { container } = renderCard();
    await waitFor(() => {
      expect(screen.queryByText("Checking two-step verification")).toBeNull();
    });
    expect(await axeViolations(container)).toEqual([]);
  });

  it("has no accessibility violations in the error state", async () => {
    serveStatusError("INTERNAL_ERROR");
    const { container } = renderCard();
    await screen.findByRole("alert");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("has no accessibility violations in the setup dialog, in each of its steps", async () => {
    const user = userEvent.setup();
    serveStatus(OFF);
    record("/setup", setupAnswer);
    renderCard({ demo: false });
    await user.click(await screen.findByRole("button", { name: "Turn on" }));
    const dialog = await screen.findByRole("dialog");
    expect(await axeViolations(dialog)).toEqual([]);
    await user.type(
      within(dialog).getByLabelText("Password", { selector: "input" }),
      "right-pass",
    );
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await within(dialog).findByRole("img", {
      name: "QR code for your authenticator app",
    });
    expect(await axeViolations(dialog)).toEqual([]);
    record("/enable", () => codesAnswer(ON));
    await user.type(
      within(dialog).getByLabelText("6-digit code", { selector: "input" }),
      "123456",
    );
    await within(dialog).findByRole(
      "list",
      { name: "Recovery codes" },
      { timeout: 4_000 },
    );
    expect(await axeViolations(dialog)).toEqual([]);
  });

  it("has no accessibility violations in the turn-off and new-codes dialogs", async () => {
    const user = userEvent.setup();
    serveStatus(ON);
    renderCard({ demo: false });
    await user.click(await screen.findByRole("button", { name: "Turn off" }));
    let dialog = await screen.findByRole("dialog");
    expect(await axeViolations(dialog)).toEqual([]);
    await user.click(
      within(dialog).getByRole("button", {
        name: "Use a recovery code instead",
      }),
    );
    expect(await axeViolations(dialog)).toEqual([]);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await user.click(
      screen.getByRole("button", { name: "New recovery codes" }),
    );
    dialog = await screen.findByRole("dialog");
    expect(await axeViolations(dialog)).toEqual([]);
  });
});
