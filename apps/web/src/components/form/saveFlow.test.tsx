import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { draftKey } from "@/lib/draft-store";
import { KitForm, LABELS, renderInRouter, signInAs, VALID } from "./kitHarness";

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
});

/** True when the browser would ask before the tab closes. */
function held(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40));
  });

const price = () => screen.findByRole("textbox", { name: LABELS.price });

describe("amounts", () => {
  it("tabbing through a read-only amount changes nothing", async () => {
    signInAs("SUPPORT");
    const user = userEvent.setup();
    renderInRouter(<KitForm readOnly defaults={{ ...VALID, price: "18.4" }} />);
    await user.click(await price());
    await user.tab();
    await settle();
    expect(await price()).toHaveValue("18.4");
    expect(held()).toBe(false);
  });

  it("tabbing through an amount that was loaded untidy is not a change", async () => {
    signInAs("SUPPORT");
    const user = userEvent.setup();
    renderInRouter(<KitForm defaults={{ ...VALID, price: "1200" }} />);
    await user.click(await price());
    await user.tab();
    await settle();
    expect(held()).toBe(false);
  });

  it("an amount that was typed is tidied when the field is left", async () => {
    signInAs("SUPPORT");
    const user = userEvent.setup();
    renderInRouter(<KitForm defaults={VALID} />);
    const field = await price();
    await user.clear(field);
    await user.type(field, "1,200.5");
    await user.tab();
    expect(field).toHaveValue("1200.50");
  });

  it("Ctrl+S inside an amount saves what the button would", async () => {
    signInAs("SUPPORT");
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(<KitForm defaults={VALID} onSave={onSave} />);
    const field = await price();
    await user.clear(field);
    await user.type(field, "1,200.5");
    await user.keyboard("{Control>}s{/Control}");
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0]).toEqual([
      expect.objectContaining({ price: "1200.50" }),
    ]);
    expect(field).toHaveFocus();
  });
});

describe("saving", () => {
  it("what is typed while a save runs stays unsaved, with its draft", async () => {
    const {
      user: { id },
    } = signInAs("SUPPORT");
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    renderInRouter(<KitForm defaults={VALID} onSave={onSave} />);
    const remarks = await screen.findByRole("textbox", {
      name: LABELS.remarks,
    });
    await user.type(remarks, "A");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    await user.type(remarks, "B");
    await act(async () => {
      finish();
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(remarks).toHaveValue("AB");
    expect(held()).toBe(true);
    expect(localStorage.getItem(draftKey(id, "test.order"))).toContain('"AB"');
  });

  it("a save with nothing typed since leaves the form clean", async () => {
    signInAs("SUPPORT");
    const user = userEvent.setup();
    renderInRouter(<KitForm defaults={VALID} />);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.remarks }),
      "A",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(held()).toBe(false);
    });
  });
});

describe("a form filled in by its defaults", () => {
  it("saves unchanged when allowClean is set, by button and by Ctrl+S", async () => {
    signInAs("SUPPORT");
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(
      <KitForm
        defaults={VALID}
        onSave={onSave}
        saveOptions={{ allowClean: true }}
      />,
    );
    const save = await screen.findByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-disabled", "false");
    await user.keyboard("{Control>}s{/Control}");
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    await user.click(save);
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(2);
    });
  });

  it("a blocked reason stops the button and Ctrl+S alike", async () => {
    signInAs("SUPPORT");
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(
      <KitForm
        defaults={VALID}
        onSave={onSave}
        saveOptions={{ blockedReason: "Finance has not confirmed payment." }}
      />,
    );
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.remarks }),
      "x",
    );
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAccessibleDescription(
      "Finance has not confirmed payment.",
    );
    await user.click(save);
    await user.keyboard("{Control>}s{/Control}");
    await settle();
    expect(onSave).not.toHaveBeenCalled();
  });
});
