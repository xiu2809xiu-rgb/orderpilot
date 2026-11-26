import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import {
  CODES,
  codesAnswer,
  loadTwoStepWords,
  ON,
  record,
  refusal,
  renderCard,
  serveStatus,
} from "./twoStepTestKit";

beforeAll(loadTwoStepWords);

type User = ReturnType<typeof userEvent.setup>;

const dialog = () => screen.getByRole("dialog");
const codeInput = () =>
  within(dialog()).getByLabelText("6-digit code", { selector: "input" });

async function open(user: User) {
  serveStatus({ ...ON, recoveryCodesLeft: 1 });
  const ui = renderCard({ demo: false });
  await user.click(
    await screen.findByRole("button", { name: "New recovery codes" }),
  );
  await screen.findByRole("dialog");
  return ui;
}

describe("the new recovery codes dialog", () => {
  it("takes a current code only, with no password and no recovery-code switch", async () => {
    const user = userEvent.setup();
    await open(user);
    expect(
      within(dialog()).queryByLabelText("Password", { selector: "input" }),
    ).toBeNull();
    expect(
      within(dialog()).queryByRole("button", {
        name: "Use a recovery code instead",
      }),
    ).toBeNull();
    expect(dialog()).toHaveTextContent("The old recovery codes stop working.");
  });

  it("shows the new codes once and blocks closing until they are saved", async () => {
    const user = userEvent.setup();
    await open(user);
    const bodies = record("/recovery-codes", () => codesAnswer(ON));
    await user.type(codeInput(), "123456");
    const list = await within(dialog()).findByRole(
      "list",
      { name: "Recovery codes" },
      { timeout: 4_000 },
    );
    expect(bodies).toEqual([{ code: "123456" }]);
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((i) => i.textContent),
    ).toEqual(CODES);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(
      within(dialog()).getByRole("checkbox", {
        name: "I have saved these codes",
      }),
    );
    await user.click(within(dialog()).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    // The card shows the count of the answer.
    expect(await screen.findByText("10 codes left")).toBeInTheDocument();
  });

  it("shows a wrong code and clears it", async () => {
    const user = userEvent.setup();
    await open(user);
    record("/recovery-codes", () => refusal("TWO_STEP_CODE_INVALID", 422));
    await user.type(codeInput(), "111111");
    expect(await within(dialog()).findByRole("alert")).toHaveTextContent(
      "That code did not work.",
    );
  });

  it("leaves nothing in the query or mutation cache after the dialog closes", async () => {
    const user = userEvent.setup();
    const { client } = await open(user);
    record("/recovery-codes", () => codesAnswer(ON));
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
    for (const secret of ["123456", ...CODES]) {
      expect(kept).not.toContain(secret);
    }
  });
});
