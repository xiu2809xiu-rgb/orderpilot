import type { Role } from "@orderpilot/shared";
import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { buildJourney } from "./journeyModel";
import { statusSentence, type StatusInput } from "./statusSentence";

beforeAll(async () => {
  await i18n.loadNamespaces(["directions-orders", "common"]);
});

const ROLES: Record<string, string> = {
  PRODUCT_MANAGER: "Product manager",
  APPROVER: "Management approver",
  SUPPORT: "Support",
  FINANCE: "Finance",
  WAREHOUSE: "Warehouse",
  LOGISTICS: "Logistics",
};
const team = (role: Role) => ROLES[role] ?? role;
const t = i18n.getFixedT("en", "directions-orders");

const journeyAt = (current: number) =>
  buildJourney({ current, events: [], stepTimes: [], today: "2026-11-20" });

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
  journey: journeyAt(2),
  heldBy: "PRODUCT_MANAGER",
  stage: "Short on stock",
  entry: null,
  detail: NO_SHORTAGE,
  ...over,
});

describe("statusSentence", () => {
  // ADR 0049, decision 2: "A short order therefore raises no SPR." It is held
  // and the customer is asked to revise the PO, so the sentence says who has the
  // order and why, and names no next step, least of all an approval.
  it("says who has a short order and why, and names no next step (ADR 0049)", () => {
    const sentence = statusSentence(t, team, input({ detail: SHORT }));
    expect(sentence).toBe(
      "With Product manager: 707 short on Samsung SSD 1 TB NVMe.",
    );
    expect(sentence).not.toMatch(/Next|approv|request to buy/i);
  });

  it("names the item by its number when the lines do not carry it", () => {
    const detail = { ...SHORT, lines: [] } as unknown as StatusInput["detail"];
    expect(statusSentence(t, team, input({ detail }))).toContain(
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
    expect(statusSentence(t, team, input({ detail: two }))).toContain(
      "short on Samsung SSD 1 TB NVMe and 1 more item.",
    );
    expect(statusSentence(t, team, input({ detail: three }))).toContain(
      "short on Samsung SSD 1 TB NVMe and 2 more items.",
    );
  });

  it("names no next step for a short order whoever holds it, so a short order is never sent on to the proforma invoice (ADR 0049)", () => {
    expect(
      statusSentence(t, team, input({ detail: SHORT, heldBy: "APPROVER" })),
    ).toBe("With Management approver: 707 short on Samsung SSD 1 TB NVMe.");
  });

  it("keeps the next step of every other stage, even when the data names a shortage", () => {
    expect(
      statusSentence(
        t,
        team,
        input({ journey: journeyAt(3), heldBy: "SUPPORT", detail: SHORT }),
      ),
    ).toBe(
      "With Support: 707 short on Samsung SSD 1 TB NVMe. Next: Finance confirms the payment.",
    );
  });

  it("names the next step and its team from the page's own journey, with no why when the data gives none", () => {
    expect(
      statusSentence(
        t,
        team,
        input({ journey: journeyAt(4), heldBy: "FINANCE" }),
      ),
    ).toBe("With Finance. Next: Warehouse packs the goods.");
    expect(
      statusSentence(
        t,
        team,
        input({ journey: journeyAt(5), heldBy: "WAREHOUSE" }),
      ),
    ).toBe("With Warehouse. Next: Support makes the invoice and packing list.");
  });

  it("says who has the order from the tracker even when the step belongs to another team", () => {
    // The sentence must not contradict the page's "Held at".
    expect(
      statusSentence(
        t,
        team,
        input({ journey: journeyAt(3), heldBy: "MANAGEMENT" }),
      ),
    ).toMatch(/^With MANAGEMENT\./);
  });

  it("has nothing next at the last step", () => {
    expect(
      statusSentence(
        t,
        team,
        input({ journey: journeyAt(9), heldBy: "LOGISTICS" }),
      ),
    ).toBe("With Logistics. This is the last step.");
  });

  it("says a finished order has nothing waiting on it", () => {
    expect(statusSentence(t, team, input({ journey: journeyAt(10) }))).toBe(
      "Every step is done. Nothing is waiting on this order.",
    );
  });

  it("falls back to the stage when the tracker's journey is not available", () => {
    expect(
      statusSentence(t, team, input({ journey: null, heldBy: null })),
    ).toBe("Short on stock.");
    expect(
      statusSentence(
        t,
        team,
        input({ journey: null, heldBy: null, detail: SHORT }),
      ),
    ).toBe("Short on stock: 707 short on Samsung SSD 1 TB NVMe.");
  });

  it("says a draft is not submitted and a void order is over, whatever else is known", () => {
    expect(
      statusSentence(
        t,
        team,
        input({ journey: null, heldBy: null, entry: "draft" }),
      ),
    ).toBe("A draft that has not been submitted, so no team has it yet.");
    expect(
      statusSentence(
        t,
        team,
        input({ journey: null, heldBy: null, entry: "void" }),
      ),
    ).toBe("Voided. Nothing more happens to this order.");
  });
});
