import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import {
  GLOSSARY_KEYS,
  withTermLabel,
  withTerms,
  type GlossaryKey,
} from "./Term";

beforeAll(async () => {
  await i18n.loadNamespaces(["components", "directions-parts"]);
});

// Words that only Help lists. No sentence of the app is searched for them, so
// `withTerms` has no pattern for them; a word is added here on purpose or it
// fails the next test until the pattern in Term.tsx has it.
const HELP_ONLY: readonly GlossaryKey[] = ["packingList", "businessCentral"];

const searched = GLOSSARY_KEYS.filter((key) => !HELP_ONLY.includes(key));

describe("the words withTerms looks for", () => {
  it.each(searched)(
    "draw the term of %s as that word, so rewording it cannot lose its tip silently",
    (key) => {
      const term = i18n.t(`components:glossary.${key}.term`);
      render(<p>{withTerms(`Look at ${term} now`)}</p>);
      const abbr = screen.getByText(term);
      expect(abbr.tagName).toBe("ABBR");
      // The tip is the word's own line, not another word's.
      expect(abbr).toHaveAccessibleDescription(
        expect.stringContaining(i18n.t(`components:glossary.${key}.meaning`)),
      );
    },
  );
});

describe("the PI line", () => {
  it("names the seller's bank details and the buyer, whoever pays", () => {
    expect(i18n.t("components:glossary.pi.meaning")).toBe(
      "An invoice sent before payment, with the seller's bank details, so the buyer can pay.",
    );
    expect(i18n.t("components:glossary.pi.long")).toBe("Proforma invoice");
  });

  it("does not call the buyer the customer on the purchase step, where Spectra pays", () => {
    const step = i18n.t("directions-parts:journey.purchase.vendorPi");
    render(<p>{withTermLabel(step)}</p>);
    const label = screen.getByText(step);
    expect(label.tagName).toBe("ABBR");
    expect(label).toHaveAccessibleDescription(/^Proforma invoice\./);
    expect(label).not.toHaveAccessibleDescription(/customer/i);
  });
});
