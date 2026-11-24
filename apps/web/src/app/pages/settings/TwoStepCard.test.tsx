import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import {
  loadTwoStepWords,
  OFF,
  ON,
  renderCard,
  serveStatus,
  serveStatusError,
} from "./twoStepTestKit";

beforeAll(loadTwoStepWords);

const card = () =>
  screen.getByRole("region", { name: "Two-step verification" });

describe("the two-step card", () => {
  it("says it is checking while the state is on its way", () => {
    serveStatus(OFF);
    renderCard();
    expect(
      screen.getByText("Checking two-step verification"),
    ).toBeInTheDocument();
  });

  it("shows two-step as off, with the Turn on button, the footnote and the demo sentence", async () => {
    serveStatus(OFF);
    renderCard();
    expect(
      await screen.findByRole("button", { name: "Turn on" }),
    ).toBeEnabled();
    expect(within(card()).getByText("Off")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Saved on the server, not on this device\. It applies at once\./,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The demo role buttons skip this step/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn off" })).toBeNull();
  });

  it("leaves out the demo sentence where the demo buttons do not exist", async () => {
    serveStatus({ ...OFF, demoSignInSkips: false });
    renderCard();
    await screen.findByRole("button", { name: "Turn on" });
    expect(
      screen.queryByText(/The demo role buttons skip this step/),
    ).toBeNull();
  });

  it("shows two-step as on, since when, and the buttons to turn off and to make new codes", async () => {
    serveStatus(ON);
    renderCard();
    expect(
      await screen.findByRole("button", { name: "Turn off" }),
    ).toBeEnabled();
    expect(within(card()).getByText("On")).toBeInTheDocument();
    expect(screen.getByText("On since 20 Nov 2026")).toBeInTheDocument();
    expect(screen.getByText("10 codes left")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New recovery codes" }),
    ).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
  });

  it("warns when two or fewer recovery codes are left, and not at three", async () => {
    serveStatus({ ...ON, recoveryCodesLeft: 2 });
    const first = renderCard();
    expect(
      await screen.findByText("Only 2 left. Make new codes soon."),
    ).toBeInTheDocument();
    first.unmount();
    serveStatus({ ...ON, recoveryCodesLeft: 3 });
    renderCard();
    await screen.findByText("3 codes left");
    expect(screen.queryByText(/Make new codes soon/)).toBeNull();
  });

  it("says one code is left in the singular", async () => {
    serveStatus({ ...ON, recoveryCodesLeft: 1 });
    renderCard();
    expect(await screen.findByText("1 code left")).toBeInTheDocument();
  });

  it("warns of a lock in the last 7 days with its date, whether the card reads on or off", async () => {
    serveStatus({ ...OFF, lastLockedAt: "2026-11-22T03:00:00.000Z" });
    const first = renderCard();
    expect(
      await screen.findByText(
        "Too many wrong codes were entered for your account on 22 Nov 2026. If that was not you, someone may know your password.",
      ),
    ).toBeInTheDocument();
    first.unmount();
    serveStatus({ ...ON, lastLockedAt: "2026-11-22T03:00:00.000Z" });
    renderCard();
    expect(await screen.findByText(/on 22 Nov 2026/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Turn off" }),
    ).toBeInTheDocument();
  });

  it("offers nothing for an account with no password, and says why", async () => {
    serveStatus({ ...OFF, hasPassword: false });
    renderCard();
    expect(
      await screen.findByText(
        "This account has no password, so there is no email and password sign-in for two-step to protect.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
    expect(screen.queryByText(/demo role buttons/)).toBeNull();
  });

  it("shows a line and no button for a demo session on an account that could not be undone", async () => {
    serveStatus({ ...OFF, demoAdminBlocked: true });
    renderCard({ role: "SYSTEM_ADMIN" });
    expect(
      await screen.findByText(
        /A demo session cannot turn on two-step verification for this account/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on" })).toBeNull();
  });

  it("still offers Turn off to a demo session when two-step is on for that account", async () => {
    serveStatus({ ...ON, demoAdminBlocked: true });
    renderCard({ role: "SYSTEM_ADMIN" });
    expect(
      await screen.findByRole("button", { name: "Turn off" }),
    ).toBeEnabled();
  });

  it("shows the error with its trace id and tries again on request", async () => {
    serveStatusError("INTERNAL_ERROR");
    const user = userEvent.setup();
    renderCard();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("trace-status-1");
    serveStatus(OFF);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", { name: "Turn on" }),
    ).toBeInTheDocument();
  });
});
