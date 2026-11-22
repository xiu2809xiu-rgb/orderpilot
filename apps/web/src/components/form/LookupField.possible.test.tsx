import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { KitForm, LABELS, renderInRouter, signInAs, VALID } from "./kitHarness";
import type { LookupOption, LookupSearch } from "./lookup";

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
  signInAs("SUPPORT");
});

const NEAR: LookupOption = {
  number: "C-0046",
  name: "Sagarun Trading",
  detail: "LK",
  possible: true,
};
const FOUND: LookupOption = {
  number: "C-0047",
  name: "Sagaran Imports",
  detail: "LK",
};

/** An answer made of the records the test names, whatever was typed. */
const answers =
  (...options: LookupOption[]): LookupSearch =>
  () =>
    Promise.resolve(options);

const lookup = () => screen.getByRole("combobox", { name: LABELS.customer });
const typeInto = async (text: string) => {
  const user = userEvent.setup();
  await user.type(
    await screen.findByRole("combobox", { name: LABELS.customer }),
    text,
  );
  return user;
};

describe("possible matches in a lookup", () => {
  it("shows a look-alike name under its own heading, marked as a possible match", async () => {
    renderInRouter(
      <KitForm
        search={answers(NEAR)}
        defaults={{ ...VALID, customer: null }}
      />,
    );
    await typeInto("Sagaran");
    const list = await screen.findByRole("listbox", { name: LABELS.customer });
    const group = within(list).getByRole("group", { name: "Possible matches" });
    expect(
      within(group).getByRole("option", {
        name: /Sagarun Trading.*possible match/,
      }),
    ).toBeVisible();
    expect(screen.getByText(/No records match "Sagaran"\./)).toBeVisible();
    expect(screen.getByText(/1 possible match\./)).toBeInTheDocument();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("is not chosen by Enter or Tab on its own, even when it is the only row", async () => {
    renderInRouter(
      <KitForm
        search={answers(NEAR)}
        defaults={{ ...VALID, customer: null }}
      />,
    );
    const user = await typeInto("Sagaran");
    await screen.findByRole("option", { name: /Sagarun/ });
    await user.keyboard("{Enter}");
    expect(lookup()).toHaveValue("Sagaran");
    await user.keyboard("{Tab}");
    await waitFor(() => {
      expect(lookup()).toHaveAttribute("aria-invalid", "true");
    });
    expect(lookup()).toHaveValue("Sagaran");
  });

  it("says at once that nothing was chosen when Enter is pressed on typed text with no row highlighted", async () => {
    renderInRouter(
      <KitForm
        search={answers(NEAR)}
        defaults={{ ...VALID, customer: null }}
      />,
    );
    const user = await typeInto("Sagaran");
    await screen.findByRole("option", { name: /Sagarun/ });
    // Still in the field: nothing has been left, so this is not the blur message.
    await user.keyboard("{Enter}");
    expect(
      await screen.findByText("Choose a customer from the list."),
    ).toBeVisible();
    expect(lookup()).toHaveFocus();
    expect(lookup()).toHaveValue("Sagaran");
    expect(screen.getByRole("option", { name: /Sagarun/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("does not stop a real match from being chosen: the only found row still wins", async () => {
    renderInRouter(
      <KitForm
        search={answers(FOUND, NEAR)}
        defaults={{ ...VALID, customer: null }}
      />,
    );
    const user = await typeInto("Sagaran");
    await screen.findByRole("option", { name: /Sagarun/ });
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(lookup()).toHaveValue("C-0047  Sagaran Imports");
    });
  });

  it("is chosen by a click, and by the arrows and then Enter", async () => {
    renderInRouter(
      <KitForm
        search={answers(NEAR)}
        defaults={{ ...VALID, customer: null }}
      />,
    );
    const user = await typeInto("Sagaran");
    await user.click(await screen.findByRole("option", { name: /Sagarun/ }));
    expect(lookup()).toHaveValue("C-0046  Sagarun Trading");

    await user.clear(lookup());
    await user.type(lookup(), "Sagaran");
    await screen.findByRole("option", { name: /Sagarun/ });
    await user.keyboard("{ArrowDown}{Enter}");
    expect(lookup()).toHaveValue("C-0046  Sagarun Trading");
  });
});
