import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { KitForm, LABELS, renderInRouter, signInAs, VALID } from "./kitHarness";
import type { LookupOption, LookupSearch } from "./lookup";

// In a browser the keys come faster than the answer: the debounce and the
// request take a moment, and a typist's down arrow arrives before them. The
// key must not be lost, and nothing may be chosen unseen.

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

function controlledSearch() {
  const calls: {
    query: string;
    answer: (options: readonly LookupOption[]) => void;
  }[] = [];
  const search: LookupSearch = (query) =>
    new Promise((resolve) => {
      calls.push({ query, answer: resolve });
    });
  return { search, calls };
}

const lookup = () => screen.getByRole("combobox", { name: LABELS.customer });

async function typeAndWait() {
  const user = userEvent.setup();
  const { search, calls } = controlledSearch();
  renderInRouter(
    <KitForm search={search} defaults={{ ...VALID, customer: null }} />,
  );
  await user.type(
    await screen.findByRole("combobox", { name: LABELS.customer }),
    "Sagaran",
  );
  await waitFor(() => {
    expect(calls.at(-1)?.query).toBe("Sagaran");
  });
  return { user, calls };
}

describe("the down arrow before the answer", () => {
  it("highlights the first row when the answer comes, and Enter then chooses a possible match", async () => {
    const { user, calls } = await typeAndWait();
    await user.keyboard("{ArrowDown}");
    calls.at(-1)?.answer([NEAR]);
    const row = await screen.findByRole("option", { name: /Sagarun/ });
    await waitFor(() => {
      expect(row).toHaveAttribute("aria-selected", "true");
    });
    // Seen, not chosen: the typed text is still what is in the box.
    expect(lookup()).toHaveValue("Sagaran");
    await user.keyboard("{Enter}");
    expect(lookup()).toHaveValue("C-0046  Sagarun Trading");
  });

  it("keeps the arrow when Enter follows it at once, and says nothing is wrong", async () => {
    const { user, calls } = await typeAndWait();
    await user.keyboard("{ArrowDown}{Enter}");
    calls.at(-1)?.answer([NEAR]);
    const row = await screen.findByRole("option", { name: /Sagarun/ });
    await waitFor(() => {
      expect(row).toHaveAttribute("aria-selected", "true");
    });
    // The possible match is shown for the next Enter: not chosen, not refused.
    expect(lookup()).toHaveValue("Sagaran");
    await waitFor(() => {
      expect(lookup()).not.toHaveAttribute("aria-invalid", "true");
    });
    await user.keyboard("{Enter}");
    expect(lookup()).toHaveValue("C-0046  Sagarun Trading");
  });

  it("still never chooses a possible match for Enter on typed text alone", async () => {
    const { user, calls } = await typeAndWait();
    await user.keyboard("{Enter}");
    calls.at(-1)?.answer([NEAR]);
    await screen.findByRole("option", { name: /Sagarun/ });
    await waitFor(() => {
      expect(lookup()).toHaveAttribute("aria-invalid", "true");
    });
    expect(lookup()).toHaveValue("Sagaran");
    expect(screen.getByRole("option", { name: /Sagarun/ })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("is dropped when the text changes before the answer", async () => {
    const { user, calls } = await typeAndWait();
    await user.keyboard("{ArrowDown}x");
    await waitFor(() => {
      expect(calls.at(-1)?.query).toBe("Sagaranx");
    });
    calls.at(-1)?.answer([NEAR]);
    const row = await screen.findByRole("option", { name: /Sagarun/ });
    expect(row).toHaveAttribute("aria-selected", "false");
  });
});
