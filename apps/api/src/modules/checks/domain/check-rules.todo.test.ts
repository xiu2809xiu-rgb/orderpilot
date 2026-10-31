import { describe, it } from "vitest";

// Area 3 (Iok Teck) writes these. The base ships no rule, so each case is
// named here and left pending. Replace an `it.todo` with a real `it` when its
// rule exists, and keep the name.

describe("the MVP mismatch: the packing list quantity against the PO", () => {
  it.todo(
    "fails when a packing list line says 40 and the PO says 50, with both lines as evidence",
  );
  it.todo("passes when the quantities are equal");
  it.todo("matches lines on the item No., never on the description");
  it.todo(
    "shows a look-alike item name with another number as a possible match, not a match",
  );
  it.todo(
    "catches every planted mismatch in the synthetic documents and raises no false alarm on the clean ones",
  );
  it.todo(
    "reports check.completed with the outcome and leaves what it holds up to area 2",
  );
});

describe("tolerances", () => {
  it.todo(
    "a tolerance is configuration, and its value is echoed in every result",
  );
  it.todo(
    "a difference equal to the tolerance passes and one unit over it fails",
  );
  it.todo("a tolerance of 0 means an exact match");
  it.todo("compares decimals without floating-point drift");
  it.todo("states the rounding it used when comparing money");
});

describe("the exceptions flow", () => {
  it.todo(
    "opens one exception for a failed check, with the difference, the tolerance and who should fix it",
  );
  it.todo(
    "does not open a second exception for the same failure when the check runs again",
  );
  it.todo("records every step of an exception in the audit trail");
});
