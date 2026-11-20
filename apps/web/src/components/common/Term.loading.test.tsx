import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type * as ReactI18next from "react-i18next";
import i18n from "@/i18n";
import { Term, withTermLabel, withTerms } from "./Term";

// A switch for the glossary text still being on its way: the real hook says
// ready once the namespace has loaded, which the first test run already did.
const loading = vi.hoisted(() => ({ on: false }));

vi.mock("react-i18next", async (importOriginal) => {
  const actual: typeof ReactI18next = await importOriginal();
  return {
    ...actual,
    useTranslation: (...args: Parameters<typeof actual.useTranslation>) => {
      const result = actual.useTranslation(...args);
      return loading.on
        ? { t: result.t, i18n: result.i18n, ready: false }
        : result;
    },
  };
});

beforeAll(async () => {
  await i18n.loadNamespaces(["components"]);
});

describe("a Term that is not focusable", () => {
  it("is described and shows the long form on hover, with no tab stop", async () => {
    const user = userEvent.setup();
    render(
      <p>
        <Term word="po" focusable={false} />
      </p>,
    );
    const abbr = screen.getByText("PO");
    expect(abbr).not.toHaveAttribute("tabindex");
    expect(abbr).toHaveAccessibleDescription(/^Purchase order\./);
    await user.tab();
    expect(document.body).toHaveFocus();
    await user.hover(abbr);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Purchase order",
    );
  });
});

describe("withTermLabel", () => {
  it("keeps a label whole in one element and describes every word in it", () => {
    render(<p>{withTermLabel("AWB/BL and permit")}</p>);
    const label = screen.getByText("AWB/BL and permit");
    expect(label.tagName).toBe("ABBR");
    expect(label).toHaveAccessibleDescription(/AWB: Air waybill\./);
    expect(label).toHaveAccessibleDescription(/BL: Bill of lading\./);
  });

  it("names each word once however often it is in the label", () => {
    render(<p>{withTermLabel("PO and PO again")}</p>);
    const description =
      screen.getByText("PO and PO again").getAttribute("aria-description") ??
      "";
    expect(description.match(/Purchase order/g)).toHaveLength(1);
  });

  it("returns a label with no glossary word as it is", () => {
    expect(withTermLabel("Goods packed")).toBe("Goods packed");
  });

  it("lists each word in the tip when there are several", async () => {
    const user = userEvent.setup();
    render(<p>{withTermLabel("AWB/BL and permit", { focusable: false })}</p>);
    await user.hover(screen.getByText("AWB/BL and permit"));
    const tip = await screen.findByRole("tooltip");
    expect(tip).toHaveTextContent("AWB: Air waybill");
    expect(tip).toHaveTextContent("BL: Bill of lading");
  });
});

describe("the tooltip's code and the glossary's text", () => {
  it("is not needed to hear a word: the description is there at once, with no tooltip", () => {
    render(<p>{withTerms("Send the PI today")}</p>);
    expect(screen.getByText("PI")).toHaveAccessibleDescription(
      /^Proforma invoice\./,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("lets the word read at once while the glossary text is still on its way", () => {
    loading.on = true;
    const { rerender } = render(<p>{withTerms("Send the PI today")}</p>);
    const abbr = screen.getByText("PI");
    expect(abbr.tagName).toBe("ABBR");
    expect(abbr).not.toHaveAttribute("aria-description");
    loading.on = false;
    rerender(<p>{withTerms("Send the PI today")}</p>);
    expect(screen.getByText("PI")).toHaveAccessibleDescription(
      /^Proforma invoice./,
    );
  });
});
