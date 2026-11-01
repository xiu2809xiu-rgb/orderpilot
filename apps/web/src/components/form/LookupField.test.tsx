import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import {
  KIT_CUSTOMERS,
  KitForm,
  LABELS,
  renderInRouter,
  signInAs,
  VALID,
} from "./kitHarness";
import type { LookupOption, LookupSearch } from "./lookup";

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
  signInAs("SUPPORT");
});

const lookup = () => screen.getByRole("combobox", { name: LABELS.customer });

/** A search whose answers the test hands out, one call at a time. */
function controlledSearch() {
  const calls: {
    query: string;
    signal: AbortSignal;
    answer: (options: readonly LookupOption[]) => void;
    fail: () => void;
  }[] = [];
  const search: LookupSearch = (query, signal) =>
    new Promise((resolve, reject) => {
      calls.push({
        query,
        signal,
        answer: resolve,
        fail: () => {
          reject(new Error("down"));
        },
      });
    });
  return { search, calls };
}

describe("the lookup field", () => {
  it("loading: says it is searching while an answer is on its way", async () => {
    const user = userEvent.setup();
    const { search, calls } = controlledSearch();
    renderInRouter(<KitForm search={search} />);
    await user.type(
      await screen.findByRole("combobox", { name: LABELS.customer }),
      "qu",
    );
    expect(screen.getAllByText("Searching...").length).toBeGreaterThan(0);
    expect(lookup()).toHaveAttribute("aria-expanded", "true");
    calls.at(-1)?.answer(KIT_CUSTOMERS.slice(0, 1));
    expect(
      await screen.findByRole("option", { name: /Quillon Harbour Traders/ }),
    ).toBeVisible();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("no results: says nothing matched the typed text", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    await user.type(
      await screen.findByRole("combobox", { name: LABELS.customer }),
      "zzz",
    );
    expect(await screen.findByText('No records match "zzz".')).toBeVisible();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(lookup()).not.toHaveAttribute("aria-controls");
    expect(screen.getByText("0 records found.")).toBeInTheDocument();
  });

  it("is keyboard first: arrows move, Enter picks, and shows number with name", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(
      <KitForm onSave={onSave} defaults={{ ...VALID, customer: null }} />,
    );
    await user.type(
      await screen.findByRole("combobox", { name: LABELS.customer }),
      "C-00",
    );
    const list = await screen.findByRole("listbox", { name: LABELS.customer });
    expect(within(list).getAllByRole("option")).toHaveLength(3);
    expect(screen.getByText("3 records found.")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    const second = within(list).getAllByRole("option")[1];
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(lookup()).toHaveAttribute("aria-activedescendant", second?.id);
    await user.keyboard("{Enter}");
    expect(lookup()).toHaveValue("C-0002  Brindle Coast Imports");
    expect(lookup()).toHaveAttribute("aria-expanded", "false");
    expect(onSave).not.toHaveBeenCalled();

    await user.keyboard("{Control>}s{/Control}");
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0]).toEqual([
      expect.objectContaining({
        customer: { number: "C-0002", name: "Brindle Coast Imports" },
      }),
    ]);
  });

  it("picks with the pointer and keeps focus in the search box", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    await user.type(
      await screen.findByRole("combobox", { name: LABELS.customer }),
      "dune",
    );
    await user.click(await screen.findByRole("option", { name: /Dunefall/ }));
    expect(lookup()).toHaveValue("C-0010  Dunefall General Trading LLC");
    expect(lookup()).toHaveFocus();
  });

  it("debounces typing, and aborts a search a newer one replaced", async () => {
    const user = userEvent.setup();
    const { search, calls } = controlledSearch();
    renderInRouter(<KitForm search={search} lookupDebounceMs={40} />);
    // Focus without a click: a click opens the list and searches at once.
    (await screen.findByRole("combobox", { name: LABELS.customer })).focus();
    await user.keyboard("dun");
    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
    expect(calls[0]?.query).toBe("dun");

    await user.keyboard("e");
    await waitFor(() => {
      expect(calls).toHaveLength(2);
    });
    expect(calls[0]?.signal.aborted).toBe(true);
    // The old answer arrives late and must not replace the newer one.
    calls[1]?.answer(KIT_CUSTOMERS.slice(2));
    calls[0]?.answer(KIT_CUSTOMERS.slice(0, 1));
    expect(
      await screen.findByRole("option", { name: /Dunefall/ }),
    ).toBeVisible();
    expect(screen.queryByRole("option", { name: /Quillon/ })).toBeNull();
  });

  it("failed: says so, and the down arrow tries again", async () => {
    const user = userEvent.setup();
    const { search, calls } = controlledSearch();
    renderInRouter(<KitForm search={search} />);
    await user.type(
      await screen.findByRole("combobox", { name: LABELS.customer }),
      "b",
    );
    calls.at(-1)?.fail();
    expect(
      (await screen.findAllByText("The search did not work."))[0],
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
    await user.keyboard("{ArrowDown}");
    calls.at(-1)?.answer(KIT_CUSTOMERS.slice(1, 2));
    expect(
      await screen.findByRole("option", { name: /Brindle/ }),
    ).toBeVisible();
  });

  it("Escape closes the list, then puts back what was there", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm defaults={VALID} />);
    const field = await screen.findByRole("combobox", {
      name: LABELS.customer,
    });
    await user.clear(field);
    await user.type(field, "qu");
    await screen.findByRole("listbox");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(field).toHaveValue("qu");
    await user.keyboard("{Escape}");
    expect(field).toHaveValue("C-0002  Brindle Coast Imports");
  });

  it("typed text with no pick leaves the field empty, so it says what is missing", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm defaults={VALID} />);
    const field = await screen.findByRole("combobox", {
      name: LABELS.customer,
    });
    await user.clear(field);
    await user.type(field, "nobody");
    await user.tab();
    expect(field).toHaveValue("nobody");
    expect(
      await screen.findByText("Choose a customer from the list."),
    ).toBeVisible();
    expect(field).toHaveAttribute("aria-invalid", "true");
  });
});
