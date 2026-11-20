import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { GLOSSARY_KEYS, Term, withTerms } from "./Term";

beforeAll(async () => {
  await i18n.loadNamespaces(["common", "components"]);
});

describe("Term", () => {
  it("is an abbreviation that a screen reader hears with its long form", () => {
    render(
      <p>
        Raise the <Term word="spr" /> now
      </p>,
    );
    const abbr = screen.getByText("SPR");
    expect(abbr.tagName).toBe("ABBR");
    expect(abbr).toHaveAccessibleDescription(
      "Stock purchase requisition. A request to buy stock that a management approver decides.",
    );
  });

  it("shows the long form on keyboard focus and puts it away on Escape", async () => {
    const user = userEvent.setup();
    render(<Term word="awb" />);
    await user.tab();
    expect(screen.getByText("AWB")).toHaveFocus();
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("Air waybill");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the long form when the pointer rests on it", async () => {
    const user = userEvent.setup();
    render(<Term word="pi" />);
    await user.hover(screen.getByText("PI"));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Proforma invoice",
    );
  });

  it("explains a phrase that has no long form by its meaning alone", async () => {
    const user = userEvent.setup();
    render(<Term word="heldAt" />);
    await user.tab();
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "The team that has the order now.",
    );
  });

  it("gives every word of the glossary a term and a meaning", () => {
    for (const key of GLOSSARY_KEYS) {
      expect(i18n.t(`components:glossary.${key}.term`)).not.toBe(
        `glossary.${key}.term`,
      );
      expect(i18n.t(`components:glossary.${key}.meaning`)).not.toBe(
        `glossary.${key}.meaning`,
      );
    }
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <p>
        <Term word="bl" /> and <Term word="po" />
      </p>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("withTerms", () => {
  it("draws each glossary word of a sentence as a term and leaves the rest", () => {
    render(<p>{withTerms("Send the PI to the customer")}</p>);
    expect(screen.getByText("PI").tagName).toBe("ABBR");
    // The description is read out, not part of the text, so the sentence is as it was.
    expect(screen.getByRole("paragraph")).toHaveTextContent(
      "Send the PI to the customer",
    );
  });

  it("finds a phrase and an abbreviation in one sentence", () => {
    render(<p>{withTerms("Held at Finance until the PO is paid")}</p>);
    expect(screen.getByText("Held at").tagName).toBe("ABBR");
    expect(screen.getByText("PO").tagName).toBe("ABBR");
  });

  it("does not take a record number for the word", () => {
    render(<p>{withTerms("Approve SPR-20261115-0003")}</p>);
    expect(document.querySelector("abbr")).toBeNull();
  });

  it("returns a sentence with no glossary word as it is", () => {
    expect(withTerms("Confirm the payment")).toBe("Confirm the payment");
  });
});
