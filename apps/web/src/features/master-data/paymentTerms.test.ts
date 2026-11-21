import { createInstance } from "i18next";
import { describe, expect, it } from "vitest";
import locale from "@/locales/en/master-data.json";
import { KNOWN_PAYMENT_TERMS, paymentTermsLabel } from "./paymentTerms";

const i18n = createInstance();
await i18n.init({
  lng: "en",
  resources: { en: { "master-data": locale } },
  defaultNS: "master-data",
  interpolation: { escapeValue: false },
});
const t = i18n.getFixedT("en", "master-data");

describe("payment terms in words", () => {
  it("words every code the data holds today", () => {
    expect(
      KNOWN_PAYMENT_TERMS.map((code) => [code, paymentTermsLabel(t, code)]),
    ).toEqual([
      ["30 DAYS", "30 days"],
      ["60 DAYS", "60 days"],
      ["PREPAID", "Prepaid"],
      ["50% ADVANCE", "50% advance"],
      ["30% DEPOSIT", "30% deposit"],
      ["LC AT SIGHT", "Letter of credit at sight"],
    ]);
  });

  it("shows a code it does not know exactly as it is", () => {
    expect(paymentTermsLabel(t, "NET 45 EOM")).toBe("NET 45 EOM");
    expect(paymentTermsLabel(t, "")).toBe("");
  });

  it("reads a code in any case, with stray spaces", () => {
    expect(paymentTermsLabel(t, " 30 days ")).toBe("30 days");
  });
});
