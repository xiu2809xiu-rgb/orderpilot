import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { normaliseDecimal } from "./decimal";
import { KitForm, LABELS, renderInRouter, signInAs, VALID } from "./kitHarness";

beforeAll(async () => {
  await i18n.loadNamespaces("form");
});

beforeEach(() => {
  localStorage.clear();
  signInAs("SUPPORT");
});

const box = (name: string) => screen.getByRole("textbox", { name });

describe("the kit's fields", () => {
  it("empty: each control has its label, its required mark and its affix", async () => {
    renderInRouter(<KitForm />);
    const po = await screen.findByRole("textbox", { name: LABELS.customerPo });
    expect(po).toHaveValue("");
    expect(po).toHaveAttribute("aria-required", "true");
    expect(box(LABELS.quantity)).toHaveAccessibleDescription("PCS");
    expect(box(LABELS.price)).toHaveAccessibleDescription("USD");
    expect(box(LABELS.price)).toHaveClass("text-right", "tabular-nums");
    expect(screen.getByLabelText(/^Ship by/)).toHaveAttribute("type", "date");
    expect(
      screen.getByRole("combobox", { name: LABELS.terms }),
    ).toHaveTextContent("Choose one");
    expect(screen.getByRole("combobox", { name: LABELS.customer })).toHaveValue(
      "",
    );
    expect(
      screen.getByRole("checkbox", { name: LABELS.partial }),
    ).not.toBeChecked();
    expect(box(LABELS.remarks)).toHaveValue("");
    expect(screen.getByText("Fields marked * are required.")).toBeVisible();
  });

  it("filled: holds what was typed, chosen or ticked", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "CPO-1",
    );
    fireEvent.change(screen.getByLabelText(/^Ship by/), {
      target: { value: "2026-11-20" },
    });
    await user.click(screen.getByRole("combobox", { name: LABELS.terms }));
    await user.click(await screen.findByRole("option", { name: "Prepaid" }));
    await user.click(screen.getByRole("checkbox", { name: LABELS.partial }));
    await user.type(box(LABELS.remarks), "Fragile");

    expect(box(LABELS.customerPo)).toHaveValue("CPO-1");
    expect(screen.getByLabelText(/^Ship by/)).toHaveValue("2026-11-20");
    expect(
      screen.getByRole("combobox", { name: LABELS.terms }),
    ).toHaveTextContent("Prepaid");
    expect(
      screen.getByRole("checkbox", { name: LABELS.partial }),
    ).toBeChecked();
    expect(box(LABELS.remarks)).toHaveValue("Fragile");
  });

  it("tidies an amount as a string, never through a float", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    const price = await screen.findByRole("textbox", { name: LABELS.price });
    await user.type(price, "1,200.5");
    await user.tab();
    expect(price).toHaveValue("1200.50");
    expect(normaliseDecimal("0.1", 2)).toBe("0.10");
    expect(normaliseDecimal("9007199254740993.99", 2)).toBe(
      "9007199254740993.99",
    );
    expect(normaliseDecimal("007", 0)).toBe("7");
    expect(normaliseDecimal("12.345", 2)).toBe("12.345");
    expect(normaliseDecimal("abc", 2)).toBe("abc");
    expect(normaliseDecimal(" ", 2)).toBe("");
  });

  it("invalid: the error shows under its field, wired to it, once touched", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    const po = await screen.findByRole("textbox", { name: LABELS.customerPo });
    await user.click(po);
    await user.tab();
    expect(
      await screen.findByText("Enter the customer's PO number."),
    ).toBeVisible();
    expect(po).toHaveAttribute("aria-invalid", "true");
    expect(po).toHaveAccessibleDescription("Enter the customer's PO number.");
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("invalid on save: every error shows and the first field takes focus", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(<KitForm onSave={onSave} />);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.remarks }),
      "x",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Enter the customer's PO number."),
    ).toBeVisible();
    expect(screen.getByText("Choose the payment terms.")).toBeVisible();
    expect(screen.getByText("Choose a customer from the list.")).toBeVisible();
    expect(box(LABELS.customerPo)).toHaveFocus();
    expect(onSave).not.toHaveBeenCalled();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("invalid: every kind of field wires its error to itself", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm />);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.remarks }),
      "Far too long a remark",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText("Enter a whole number.");
    const wired: [HTMLElement, string][] = [
      [box(LABELS.customerPo), "Enter the customer's PO number."],
      [box(LABELS.quantity), "Enter a whole number."],
      [box(LABELS.price), "Enter an amount such as 12.50."],
      [screen.getByLabelText(/^Ship by/), "Enter the ship-by date."],
      [
        screen.getByRole("combobox", { name: LABELS.terms }),
        "Choose the payment terms.",
      ],
      [
        screen.getByRole("combobox", { name: LABELS.customer }),
        "Choose a customer from the list.",
      ],
      [box(LABELS.remarks), "Keep remarks to 10 characters."],
    ];
    for (const [control, message] of wired) {
      expect(control).toHaveAttribute("aria-invalid", "true");
      expect(control).toHaveAccessibleDescription(
        expect.stringContaining(message),
      );
    }
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("read-only: numbers, amounts and dates are not editable either", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm readOnly defaults={VALID} />);
    await screen.findByRole("textbox", { name: LABELS.customerPo });
    for (const control of [
      box(LABELS.quantity),
      box(LABELS.price),
      screen.getByLabelText(/^Ship by/),
    ]) {
      expect(control).toHaveAttribute("readonly");
      await user.type(control, "9");
    }
    expect(box(LABELS.quantity)).toHaveValue("12");
    expect(box(LABELS.price)).toHaveValue("18.40");
    expect(screen.getByLabelText(/^Ship by/)).toHaveValue("2026-11-20");
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("disabled: nothing can be changed", async () => {
    renderInRouter(<KitForm disabled />);
    await screen.findByRole("textbox", { name: LABELS.customerPo });
    for (const name of [
      LABELS.customerPo,
      LABELS.quantity,
      LABELS.price,
      LABELS.remarks,
    ]) {
      expect(box(name)).toBeDisabled();
    }
    expect(screen.getByLabelText(/^Ship by/)).toBeDisabled();
    expect(screen.getByRole("combobox", { name: LABELS.terms })).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: LABELS.customer }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: LABELS.partial }),
    ).toBeDisabled();
  });

  it("read-only: shown, focusable and copyable, but not editable", async () => {
    const user = userEvent.setup();
    renderInRouter(<KitForm readOnly defaults={VALID} />);
    const po = await screen.findByRole("textbox", { name: LABELS.customerPo });
    expect(po).toHaveAttribute("readonly");
    await user.type(po, "more");
    expect(po).toHaveValue("CPO-7731");
    expect(box(LABELS.terms)).toHaveValue("Prepaid");
    expect(box(LABELS.customer)).toHaveValue("C-0002  Brindle Coast Imports");
    await user.click(screen.getByRole("checkbox", { name: LABELS.partial }));
    expect(
      screen.getByRole("checkbox", { name: LABELS.partial }),
    ).not.toBeChecked();
    await user.click(box(LABELS.price));
    expect(box(LABELS.price)).toHaveFocus();
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("Enter in a single-line field never submits", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(<KitForm onSave={onSave} defaults={VALID} />);
    await user.type(
      await screen.findByRole("textbox", { name: LABELS.customerPo }),
      "9{Enter}",
    );
    await user.type(box(LABELS.quantity), "{Enter}");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("Save says why it cannot run, and Ctrl+S saves once there are changes", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(() => Promise.resolve());
    renderInRouter(<KitForm onSave={onSave} defaults={VALID} />);
    const save = await screen.findByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription("No changes to save.");
    await user.keyboard("{Control>}s{/Control}");
    expect(onSave).not.toHaveBeenCalled();

    await user.type(box(LABELS.remarks), "Fragile");
    expect(save).toHaveAttribute("aria-disabled", "false");
    await user.keyboard("{Control>}s{/Control}");
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
    });
    expect(onSave.mock.calls[0]).toEqual([
      expect.objectContaining({ remarks: "Fragile", customerPo: "CPO-7731" }),
    ]);
    await waitFor(() => {
      expect(save).toHaveAttribute("aria-disabled", "true");
    });
  });
});
