import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import { useToastStore } from "@/components/common/toast";
import {
  json,
  loadTwoStepWords,
  networkFailure,
  OFF,
  ON,
  record,
  refusal,
  renderCard,
  serveStatus,
} from "./twoStepTestKit";

beforeAll(loadTwoStepWords);

type User = ReturnType<typeof userEvent.setup>;

const dialog = () => screen.getByRole("dialog");
const within_ = () => within(dialog());
const password = () =>
  within_().getByLabelText("Password", { selector: "input" });
const codeInput = () =>
  within_().getByLabelText("6-digit code", { selector: "input" });
const turnOff = () => within_().getByRole("button", { name: "Turn off" });

async function open(user: User, demo: boolean) {
  serveStatus(ON);
  renderCard({ demo });
  await user.click(await screen.findByRole("button", { name: "Turn off" }));
  await screen.findByRole("dialog");
}

describe("the turn-off dialog", () => {
  it("turns off with a code and the password for a password session, then shows the card as off", async () => {
    const user = userEvent.setup();
    await open(user, false);
    const bodies = record("/disable", () => json({ data: OFF }));
    await user.type(password(), "right-pass");
    await user.type(codeInput(), "123456");
    await waitFor(
      () => {
        expect(screen.queryByRole("dialog")).toBeNull();
      },
      { timeout: 4_000 },
    );
    expect(bodies).toEqual([{ code: "123456", password: "right-pass" }]);
    expect(useToastStore.getState().items.map((i) => i.message)).toEqual([
      "Two-step verification is off",
    ]);
    expect(
      await screen.findByRole("button", { name: "Turn on" }),
    ).toBeInTheDocument();
  });

  it("turns off with a recovery code", async () => {
    const user = userEvent.setup();
    await open(user, false);
    const bodies = record("/disable", () => json({ data: OFF }));
    await user.click(
      within_().getByRole("button", { name: "Use a recovery code instead" }),
    );
    await user.type(password(), "right-pass");
    await user.type(
      within_().getByLabelText("Recovery code"),
      "TESTA-TESTB-TSTC1",
    );
    await user.click(turnOff());
    await waitFor(
      () => {
        expect(screen.queryByRole("dialog")).toBeNull();
      },
      { timeout: 4_000 },
    );
    expect(bodies).toEqual([
      { recoveryCode: "TESTA-TESTB-TSTC1", password: "right-pass" },
    ]);
  });

  it("asks for no password in a demo session", async () => {
    const user = userEvent.setup();
    await open(user, true);
    expect(
      within_().queryByLabelText("Password", { selector: "input" }),
    ).toBeNull();
    const bodies = record("/disable", () => json({ data: OFF }));
    await user.type(codeInput(), "123456");
    await waitFor(
      () => {
        expect(screen.queryByRole("dialog")).toBeNull();
      },
      { timeout: 4_000 },
    );
    expect(bodies).toEqual([{ code: "123456" }]);
  });

  it("asks for the password, and sends nothing, when a code is typed without one", async () => {
    const user = userEvent.setup();
    await open(user, false);
    const bodies = record("/disable", () => json({ data: OFF }));
    await user.type(codeInput(), "123456");
    expect(within_().getByText("Enter your password.")).toBeInTheDocument();
    expect(bodies).toEqual([]);
    expect(codeInput()).toHaveValue("123456");
  });

  it("shows a wrong password, empties it, and keeps the digits for another try", async () => {
    const user = userEvent.setup();
    await open(user, false);
    record("/disable", () => refusal("PASSWORD_INCORRECT", 422));
    await user.type(password(), "wrong-pass");
    await user.type(codeInput(), "123456");
    expect(await within_().findByRole("alert")).toHaveTextContent(
      "The password is not right.",
    );
    expect(password()).toHaveValue("");
    expect(codeInput()).toHaveValue("123456");
  });

  it("shows a wrong code and clears it", async () => {
    const user = userEvent.setup();
    await open(user, true);
    record("/disable", () => refusal("TWO_STEP_CODE_INVALID", 422));
    await user.type(codeInput(), "111111");
    expect(await within_().findByRole("alert")).toHaveTextContent(
      "That code did not work.",
    );
    await waitFor(() => {
      expect(codeInput()).toHaveValue("");
    });
  });

  it("words a lock in minutes, and in hours above 90 minutes", async () => {
    const user = userEvent.setup();
    await open(user, true);
    record("/disable", () =>
      refusal("TWO_STEP_LOCKED", 429, { "Retry-After": "86400" }),
    );
    await user.type(codeInput(), "111111");
    expect(await within_().findByRole("alert")).toHaveTextContent(
      "Too many wrong codes. Try again in 24 hours",
    );
  });

  it("keeps the digits and shows the failure for a network error, so the button is the retry", async () => {
    const user = userEvent.setup();
    await open(user, true);
    record("/disable", networkFailure);
    await user.type(codeInput(), "123456");
    expect(await within_().findByRole("alert")).toHaveTextContent(
      "could not reach the server",
    );
    expect(codeInput()).toHaveValue("123456");
    expect(turnOff()).toBeEnabled();
  });

  it("closes on Cancel and leaves the card as it was", async () => {
    const user = userEvent.setup();
    await open(user, true);
    await user.click(within_().getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Turn off" }),
    ).toBeInTheDocument();
  });
});

describe("the turn-off dialog, recovery-code mode and a short code", () => {
  async function openRecovery(user: User) {
    await open(user, true);
    await user.click(
      within_().getByRole("button", { name: "Use a recovery code instead" }),
    );
  }
  const recoveryInput = () => within_().getByLabelText("Recovery code");

  it("keeps the recovery input focused and read-only while checked, says it is verifying, and gives a wrong code words of its own", async () => {
    const user = userEvent.setup();
    await openRecovery(user);
    record("/disable", () => refusal("TWO_STEP_CODE_INVALID", 422));
    await user.type(recoveryInput(), "TESTA-TESTB-TSTC1{Enter}");

    const status = await within_().findByText("Verifying recovery code");
    expect(status).toHaveAttribute("role", "status");
    expect(recoveryInput()).toHaveAttribute("readonly");
    expect(recoveryInput()).toHaveAttribute("aria-readonly", "true");
    expect(recoveryInput()).not.toBeDisabled();
    expect(recoveryInput()).toHaveFocus();

    const alert = await within_().findByRole("alert");
    expect(alert).toHaveTextContent(
      "That recovery code did not work. Check it and try again.",
    );
    expect(alert).not.toHaveTextContent("clock");
    await waitFor(() => {
      expect(recoveryInput()).not.toHaveAttribute("readonly");
    });
    expect(recoveryInput()).toHaveFocus();
  });

  it("says when the recovery code was verified", async () => {
    const user = userEvent.setup();
    await openRecovery(user);
    record("/disable", () => json({ data: OFF }));
    await user.type(recoveryInput(), "TESTA-TESTB-TSTC1{Enter}");
    expect(
      await within_().findByText("Recovery code verified"),
    ).toHaveAttribute("role", "status");
  });

  it("tells a code of fewer than six digits so at the field, with focus in it and no alert", async () => {
    const user = userEvent.setup();
    await open(user, true);
    const bodies = record("/disable", () => json({ data: OFF }));
    await user.type(codeInput(), "123");
    await user.click(turnOff());

    const note = within_().getByText("Enter all 6 digits.");
    expect(note).toBeVisible();
    expect(codeInput().getAttribute("aria-describedby")).toContain(note.id);
    expect(codeInput()).toHaveFocus();
    expect(within_().queryByRole("alert")).toBeNull();
    expect(bodies).toEqual([]);
    await user.type(codeInput(), "4");
    expect(within_().queryByText("Enter all 6 digits.")).toBeNull();
  });
});
