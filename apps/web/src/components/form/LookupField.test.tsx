import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { draftKey } from "@/lib/draft-store";
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
    // Nothing to point at yet: the combobox is not "expanded" without a list.
    expect(lookup()).toHaveAttribute("aria-expanded", "false");
    calls.at(-1)?.answer(KIT_CUSTOMERS.slice(0, 1));
    expect(
      await screen.findByRole("option", { name: /Quillon Harbour Traders/ }),
    ).toBeVisible();
    expect(lookup()).toHaveAttribute("aria-expanded", "true");
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
    renderInRouter(<KitForm search={search} lookupDebounceMs={400} />);
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

  it("never lets the keyboard pick from the answer to older text", async () => {
    const user = userEvent.setup();
    const { search, calls } = controlledSearch();
    renderInRouter(<KitForm search={search} />);
    const field = await screen.findByRole("combobox", {
      name: LABELS.customer,
    });
    await user.click(field);
    calls.at(-1)?.answer(KIT_CUSTOMERS);
    await screen.findByRole("option", { name: /Quillon/ });

    await user.type(field, "dune");
    // The answer for "dune" is still on its way: the old rows are gone.
    expect(screen.queryByRole("option")).toBeNull();
    await user.keyboard("{ArrowDown}{Enter}");
    expect(field).toHaveValue("dune");

    calls.at(-1)?.answer(KIT_CUSTOMERS.slice(2));
    // Enter was pressed with no highlighted row and a single answer: it picks.
    await waitFor(() => {
      expect(field).toHaveValue("C-0010  Dunefall General Trading LLC");
    });
  });

  it("Enter on a record number picks that record, even before the answer", async () => {
    const user = userEvent.setup();
    const { search, calls } = controlledSearch();
    renderInRouter(<KitForm search={search} />);
    const field = await screen.findByRole("combobox", {
      name: LABELS.customer,
    });
    await user.type(field, "c-0001{Enter}");
    expect(field).toHaveValue("c-0001");
    calls.at(-1)?.answer(KIT_CUSTOMERS.slice(0, 2));
    await waitFor(() => {
      expect(field).toHaveValue("C-0001  Quillon Harbour Traders");
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("Tab on a record number picks that record and leaves", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    const field = await screen.findByRole("combobox", {
      name: LABELS.customer,
    });
    await user.type(field, "C-0002");
    await screen.findByRole("option", { name: /Brindle/ });
    await user.tab();
    expect(field).toHaveValue("C-0002  Brindle Coast Imports");
    expect(field).not.toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Choose a customer from the list.")).toBeNull();
  });

  it("tells the page which record was picked", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderInRouter(<KitForm onPick={onPick} />);
    await user.type(
      await screen.findByRole("combobox", { name: LABELS.customer }),
      "dune",
    );
    await user.click(await screen.findByRole("option", { name: /Dunefall/ }));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ number: "C-0010", detail: "AE" }),
    );
  });

  it("keeps the highlighted row in view as the arrows move", async () => {
    const user = userEvent.setup();
    const scroll = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scroll;
    renderInRouter(<KitForm />);
    await user.click(
      await screen.findByRole("combobox", { name: LABELS.customer }),
    );
    await screen.findByRole("option", { name: /Quillon/ });
    scroll.mockClear();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(scroll).toHaveBeenLastCalledWith({ block: "nearest" });
    expect(lookup()).toHaveAttribute(
      "aria-activedescendant",
      screen.getByRole("option", { name: /Brindle/ }).id,
    );
    window.HTMLElement.prototype.scrollIntoView = () => undefined;
  });

  it("has no axe violations with the list open and nothing found", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    await user.type(
      await screen.findByRole("combobox", { name: LABELS.customer }),
      "zzzz",
    );
    await screen.findByText(/No records match/);
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("Discard clears typing that never became a pick", async () => {
    const user = userEvent.setup();
    const {
      user: { id },
    } = signInAs("SUPPORT");
    localStorage.setItem(
      draftKey(id, "test.order"),
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        values: { customerPo: "CPO-R" },
      }),
    );
    renderInRouter(<KitForm />);
    const field = await screen.findByRole("combobox", {
      name: LABELS.customer,
    });
    await user.type(field, "zzzz");
    await user.tab();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: LABELS.customer }),
      ).toHaveValue("");
    });
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
