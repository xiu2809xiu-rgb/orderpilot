import type { CheckResult } from "@orderpilot/shared";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { statusSentence, type StatusInput } from "./statusSentence";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-orders", "common"]);
});

const t = i18n.getFixedT("en", "directions-orders");

const SHORT = {
  shortage: {
    itemNo: "I-0075",
    ordered: "1000.00",
    availableStock: "293.00",
    shortBy: "707.00",
  },
  shortageCount: 1,
  lines: [{ itemNo: "I-0075", description: "Samsung SSD 1 TB NVMe" }],
} as unknown as StatusInput["detail"];

const NO_SHORTAGE = {
  shortage: null,
  shortageCount: 0,
  lines: [],
} as unknown as StatusInput["detail"];

const input = (over: Partial<StatusInput>): StatusInput => ({
  detail: NO_SHORTAGE,
  checks: [],
  ...over,
});

/** A check as the tracker sends it; only what the sentence reads is set. */
const check = (ruleId: string, outcome: "pass" | "fail"): CheckResult =>
  ({
    id: `c-${ruleId}`,
    ruleId,
    ruleLabel: `Label of ${ruleId}`,
    outcome,
  }) as unknown as CheckResult;

describe("statusSentence", () => {
  // ADR 0049, decision 2: a short order is held and the customer is asked to
  // revise the PO. Current Stage and Held at already say who has it and on
  // what stage, so the sentence names neither, only why.
  it("says why a short order is held, naming neither the team nor the step (ADR 0049)", () => {
    const sentence = statusSentence(t, input({ detail: SHORT }));
    expect(sentence).toBe("707 short on Samsung SSD 1 TB NVMe.");
    expect(sentence).not.toMatch(/With|Next|approv|request to buy/i);
  });

  it("names the item by its number when the lines do not carry it", () => {
    const detail = { ...SHORT, lines: [] } as unknown as StatusInput["detail"];
    expect(statusSentence(t, input({ detail }))).toContain(
      "707 short on I-0075.",
    );
  });

  it("counts the other short items in the right plural", () => {
    const two = {
      ...SHORT,
      shortageCount: 2,
    } as unknown as StatusInput["detail"];
    const three = {
      ...SHORT,
      shortageCount: 3,
    } as unknown as StatusInput["detail"];
    expect(statusSentence(t, input({ detail: two }))).toContain(
      "short on Samsung SSD 1 TB NVMe and 1 more item.",
    );
    expect(statusSentence(t, input({ detail: three }))).toContain(
      "short on Samsung SSD 1 TB NVMe and 2 more items.",
    );
  });

  // SO-0041 on the demo data: the packing list says 108 where the PO says
  // 120. The failed check holds the order; the sentence says why, in words.
  it("says why a failed quantity check holds the order", () => {
    const sentence = statusSentence(
      t,
      input({
        checks: [
          check("mock.sample-customer-no", "pass"),
          check("mock.sample-quantity", "fail"),
        ],
      }),
    );
    expect(sentence).toBe("The packing list differs from the PO.");
  });

  it("says a failed price check in its own words, and a rule it does not know by its label", () => {
    expect(
      statusSentence(
        t,
        input({ checks: [check("mock.sample-price", "fail")] }),
      ),
    ).toBe("The unit price on the PI differs from the PO.");
    expect(
      statusSentence(t, input({ checks: [check("rule.other", "fail")] })),
    ).toBe("A check did not pass: Label of rule.other.");
  });

  // The page says one reason in this sentence and the Checks tab lists every
  // failed check, so the first one in the tracker's order is the one said.
  it("says only the first failed check when two failed, in the tracker's order", () => {
    const sentence = (checks: readonly CheckResult[]) =>
      statusSentence(t, input({ checks }));
    const quantityFirst = sentence([
      check("mock.sample-quantity", "fail"),
      check("mock.sample-price", "fail"),
    ]);
    expect(quantityFirst).toBe("The packing list differs from the PO.");
    expect(quantityFirst).not.toMatch(/price/i);
    expect(
      sentence([
        check("mock.sample-price", "fail"),
        check("mock.sample-quantity", "fail"),
      ]),
    ).toBe("The unit price on the PI differs from the PO.");
  });

  it("says the shortage, not a failed check, when the order has both", () => {
    expect(
      statusSentence(
        t,
        input({ detail: SHORT, checks: [check("mock.sample-price", "fail")] }),
      ),
    ).toBe("707 short on Samsung SSD 1 TB NVMe.");
  });

  it("says nothing with no shortage and no failed check: Current Stage and Held at already say who has it and on what stage", () => {
    expect(
      statusSentence(
        t,
        input({ checks: [check("mock.sample-quantity", "pass")] }),
      ),
    ).toBe("");
    expect(statusSentence(t, input({}))).toBe("");
  });
});
