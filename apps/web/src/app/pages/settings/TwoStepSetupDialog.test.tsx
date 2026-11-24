import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { useToastStore } from "@/components/common/toast";
import {
  CODES,
  codesAnswer,
  loadTwoStepWords,
  networkFailure,
  OFF,
  ON,
  record,
  refusal,
  renderCard,
  serveStatus,
  setupAnswer,
  SETUP_KEY,
} from "./twoStepTestKit";

beforeAll(loadTwoStepWords);
afterEach(() => {
  vi.unstubAllGlobals();
});

type User = ReturnType<typeof userEvent.setup>;

const dialog = () => screen.getByRole("dialog");
const password = () =>
  within(dialog()).getByLabelText("Password", { selector: "input" });
const codeInput = () =>
  within(dialog()).getByLabelText("6-digit code", { selector: "input" });
const press = (user: User, name: string) =>
  user.click(within(dialog()).getByRole("button", { name }));

/** Open the dialog from the card, as a password session or a demo session. */
async function open(user: User, demo: boolean) {
  serveStatus(OFF);
  const ui = renderCard({ demo, role: "MANAGEMENT" });
  await user.click(await screen.findByRole("button", { name: "Turn on" }));
  await screen.findByRole("dialog");
  return ui;
}

async function reachScan(user: User) {
  record("/setup", setupAnswer);
  await user.type(password(), "right-pass");
  await press(user, "Continue");
  await within(dialog()).findByRole("img", {
    name: "QR code for your authenticator app",
  });
}

describe("the setup dialog", () => {
  it("asks a password session for the password first and sends it with the setup call", async () => {
    const user = userEvent.setup();
    await open(user, false);
    expect(dialog()).toHaveTextContent("Turn on two-step verification");
    const bodies = record("/setup", setupAnswer);
    await user.type(password(), "right-pass");
    await press(user, "Continue");
    await screen.findByRole("img", {
      name: "QR code for your authenticator app",
    });
    expect(bodies).toEqual([{ password: "right-pass" }]);
  });

  it("asks for the password again, and says so, when it is left empty", async () => {
    const user = userEvent.setup();
    await open(user, false);
    const bodies = record("/setup", setupAnswer);
    await press(user, "Continue");
    expect(
      within(dialog()).getByText("Enter your password."),
    ).toBeInTheDocument();
    expect(bodies).toEqual([]);
  });

  it("shows a wrong password as a failure with its trace id, and empties the field", async () => {
    const user = userEvent.setup();
    await open(user, false);
    record("/setup", () => refusal("PASSWORD_INCORRECT", 422));
    await user.type(password(), "wrong-pass");
    await press(user, "Continue");
    const alert = await within(dialog()).findByRole("alert");
    expect(alert).toHaveTextContent("The password is not right.");
    expect(alert).toHaveTextContent("trace-test-1");
    expect(password()).toHaveValue("");
    await waitFor(() => {
      expect(password()).toHaveFocus();
    });
  });

  it("skips the password step for a demo session, starts at once, and warns that the account is shared", async () => {
    const user = userEvent.setup();
    const bodies = record("/setup", setupAnswer);
    serveStatus(OFF);
    renderCard({ demo: true });
    await user.click(await screen.findByRole("button", { name: "Turn on" }));
    await screen.findByRole("img", {
      name: "QR code for your authenticator app",
    });
    expect(bodies).toEqual([{}]);
    expect(
      within(dialog()).queryByLabelText("Password", { selector: "input" }),
    ).toBeNull();
    expect(dialog()).toHaveTextContent("This is a shared demo account.");
  });

  it("shows the QR code and the setup key as text, in groups of four, with the 10 minute note", async () => {
    const user = userEvent.setup();
    await open(user, false);
    await reachScan(user);
    expect(screen.getByTestId("setup-key")).toHaveTextContent(
      "AAAA BBBB CCCC DDDD EEEE FFFF GGGG HHHH",
    );
    expect(dialog()).toHaveTextContent("This setup ends in 10 minutes.");
    expect(dialog()).toHaveTextContent("Then enter the 6-digit code it shows");
  });

  it("turns two-step on with the first right code, then shows ten recovery codes that block closing until saved", async () => {
    const user = userEvent.setup();
    await open(user, false);
    await reachScan(user);
    const bodies = record("/enable", () => codesAnswer(ON));
    await user.type(codeInput(), "123456");
    await within(dialog()).findByRole(
      "list",
      { name: "Recovery codes" },
      { timeout: 4_000 },
    );
    expect(bodies).toEqual([{ code: "123456" }]);
    // The setup key is gone as soon as the codes are drawn.
    expect(dialog()).not.toHaveTextContent(SETUP_KEY.slice(0, 8));
    const items = within(
      within(dialog()).getByRole("list", { name: "Recovery codes" }),
    ).getAllByRole("listitem");
    expect(items.map((i) => i.textContent)).toEqual(CODES);
    // Escape, an outside click and a close button are all refused.
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      within(dialog()).queryByRole("button", { name: "Close" }),
    ).toBeNull();
    const done = within(dialog()).getByRole("button", { name: "Done" });
    expect(done).toBeDisabled();
    await user.click(
      within(dialog()).getByRole("checkbox", {
        name: "I have saved these codes",
      }),
    );
    expect(done).toBeEnabled();
    await user.click(done);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(useToastStore.getState().items.map((i) => i.message)).toEqual([
      "Two-step verification is on",
    ]);
    // The card now reads On, from the answer of the enable call.
    expect(
      await screen.findByRole("button", { name: "Turn off" }),
    ).toBeInTheDocument();
  });

  it("shows a wrong code as a failure and clears the digits", async () => {
    const user = userEvent.setup();
    await open(user, false);
    await reachScan(user);
    record("/enable", () => refusal("TWO_STEP_CODE_INVALID", 422));
    await user.type(codeInput(), "111111");
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "That code did not work.",
    );
    await waitFor(() => {
      expect(codeInput()).toHaveValue("");
    });
  });

  it("words a lock with the wait from Retry-After", async () => {
    const user = userEvent.setup();
    await open(user, false);
    await reachScan(user);
    record("/enable", () =>
      refusal("TWO_STEP_LOCKED", 429, { "Retry-After": "900" }),
    );
    await user.type(codeInput(), "111111");
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "Too many wrong codes. Try again in 15 minutes",
    );
  });

  it("goes back to the first step with the failure when the setup has lapsed", async () => {
    const user = userEvent.setup();
    await open(user, false);
    await reachScan(user);
    record("/enable", () => refusal("TWO_STEP_SETUP_ENDED", 409));
    await user.type(codeInput(), "123456");
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "The setup ended. Start again to get a new key.",
    );
    expect(
      within(dialog()).queryByRole("img", {
        name: "QR code for your authenticator app",
      }),
    ).toBeNull();
    expect(password()).toBeInTheDocument();
  });

  it("keeps the typed digits and shows the failure for a network error", async () => {
    const user = userEvent.setup();
    await open(user, false);
    await reachScan(user);
    record("/enable", networkFailure);
    await user.type(codeInput(), "123456");
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "could not reach the server",
    );
    expect(codeInput()).toHaveValue("123456");
  });

  it("closes on Cancel in the first step with no call", async () => {
    const user = userEvent.setup();
    await open(user, false);
    const bodies = record("/setup", setupAnswer);
    await press(user, "Cancel");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bodies).toEqual([]);
  });

  it("copies the codes and offers a text file", async () => {
    const user = userEvent.setup();
    const written: string[] = [];
    // userEvent.setup() has put its own clipboard on the page: spy on that one.
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation((text) => {
      written.push(text);
      return Promise.resolve();
    });
    const url = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
    await open(user, false);
    await reachScan(user);
    record("/enable", () => codesAnswer(ON));
    await user.type(codeInput(), "123456");
    await within(dialog()).findByRole(
      "list",
      { name: "Recovery codes" },
      { timeout: 4_000 },
    );
    await press(user, "Copy codes");
    expect(written).toEqual([CODES.join("\n")]);
    expect(
      await screen.findByText("Recovery codes copied"),
    ).toBeInTheDocument();
    await press(user, "Download as text file");
    expect(url).toHaveBeenCalledTimes(1);
    const blob = url.mock.calls[0]?.[0] as Blob;
    const text = await blob.text();
    expect(text).toContain("OrderPilot recovery codes");
    expect(text).toContain(CODES[0]);
  });

  it("leaves nothing in the query or mutation cache after the dialog closes", async () => {
    const user = userEvent.setup();
    const { client } = await open(user, false);
    await reachScan(user);
    record("/enable", () => codesAnswer(ON));
    await user.type(codeInput(), "123456");
    await within(dialog()).findByRole(
      "list",
      { name: "Recovery codes" },
      { timeout: 4_000 },
    );
    await user.click(
      within(dialog()).getByRole("checkbox", {
        name: "I have saved these codes",
      }),
    );
    await user.click(within(dialog()).getByRole("button", { name: "Done" }));
    expect(client.getMutationCache().getAll()).toEqual([]);
    const kept = JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((q) => [q.queryKey, q.state.data]),
    );
    for (const secret of [SETUP_KEY, "right-pass", "123456", ...CODES]) {
      expect(kept).not.toContain(secret);
    }
  });
});
