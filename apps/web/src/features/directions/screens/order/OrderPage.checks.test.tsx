import { screen, within } from "@testing-library/react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { CheckResult, Role } from "@orderpilot/shared";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { loadNamespaces, stubApi } from "../orders/ordersTestKit";
import { OrderPage } from "./OrderPage";
import { renderWithToasts, stubTimeline } from "./orderPageTestKit";
import { isPriceCheck } from "./priceChecks";

/**
 * The Checks tab for a role whose prices are masked. The tracker sends every
 * check's expected and actual values as plain text (issue #291), so the page
 * covers a price check with the mask when the order's own amount came back
 * masked, and still shows a quantity.
 */
const ORDER = "SO-0069";

type Check = CheckResult;

const unitPricePlace = {
  documentId: "po",
  documentType: "CUSTOMER_PO",
  location: "item I-0075: unit price",
  value: "61.20",
} as const;

const price: Check = {
  id: "price",
  ruleId: "mock.sample-price",
  ruleLabel: "Unit price on the PI against the PO (sample result)",
  orderNo: ORDER,
  outcome: "fail",
  expected: "61.20",
  actual: "64.80",
  tolerance: {
    label: "Price difference in USD (sample value)",
    value: "0.00",
  },
  evidence: [
    unitPricePlace,
    {
      documentId: "pi",
      documentType: "PROFORMA_INVOICE",
      location: "item I-0075: unit price",
      value: "64.80",
    },
  ],
  checkedAt: "2026-11-20T01:00:00.000Z",
};

const quantity: Check = {
  ...price,
  id: "quantity",
  ruleId: "mock.sample-quantity",
  ruleLabel: "Packing list quantity against the PO (sample result)",
  expected: "120",
  actual: "108",
  tolerance: {
    label: "Quantity difference in units (sample value)",
    value: "0",
  },
  evidence: [
    {
      documentId: "po",
      documentType: "CUSTOMER_PO",
      location: "item I-0217: quantity",
      value: "120",
    },
  ],
};

beforeAll(async () => {
  await loadNamespaces();
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The order's Checks tab, as one role sees it. `noRecord` has the Orders API
 * answer 404 for the order while the tracker still knows it: the page has the
 * checks but not the order's own amount.
 */
async function checksWith(
  role: Role,
  checks: readonly Check[],
  options: { masked: boolean; noRecord?: boolean },
) {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
  stubApi({
    masked: options.masked,
    specs: [
      {
        orderNo: ORDER,
        customerNo: "C-0005",
        customerName: "Alpha Traders",
        status: {
          code: "sample-pi-to-send",
          label: "Proforma invoice to send",
        },
        ownerRole: "SUPPORT",
        value: "1000.00",
        orderedDaysAgo: 5,
        shipInDays: 9,
      },
    ],
  });
  // The kit types a check's document as a plain string; the page reads the shared type.
  stubTimeline((timeline) => ({ ...timeline, checks: [...checks] }));
  if (options.noRecord) {
    const inner = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
          "http://localhost",
        ).pathname;
        return /\/orders\/SO-[\w-]+$/.test(path) && !path.includes("/tracker/")
          ? Promise.resolve(
              new Response(
                JSON.stringify({
                  error: {
                    code: "NOT_FOUND",
                    message: "x",
                    details: null,
                    traceId: "trace-404",
                  },
                }),
                {
                  status: 404,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            )
          : inner(input, init);
      }),
    );
  }
  renderWithToasts(
    <OrderPage orderNo={ORDER} />,
    `/orders/${ORDER}?tab=checks`,
  );
  const panel = await screen.findByRole("tabpanel", { name: /^Checks/ });
  const rows = await within(panel).findAllByRole("listitem");
  const byRule = (label: RegExp) => {
    const row = rows.find((item) => label.test(item.textContent));
    if (!row) throw new Error("No check row");
    return row;
  };
  return { panel, byRule };
}

/** The order's Checks tab, as one role sees it, with a price check and a quantity check. */
async function checksAs(role: Role, masked: boolean) {
  const { panel, byRule } = await checksWith(role, [price, quantity], {
    masked,
  });
  return {
    panel,
    price: byRule(/^.*Unit price/),
    quantity: byRule(/Packing list quantity/),
  };
}

describe("the Checks tab of a role whose prices are masked", () => {
  it("shows the mask and its reason, and no figure, for a price check", async () => {
    const { panel, price: row } = await checksAs("WAREHOUSE", true);
    expect(row).not.toHaveTextContent(/61\.20|64\.80/);
    expect(panel.textContent).not.toMatch(/61\.20|64\.80/);
    // The mask is the page's own, with its reason for a screen reader and the tooltip.
    expect(
      within(row).getAllByText(
        /Hidden: prices are for roles that work with pricing/,
      ).length,
    ).toBeGreaterThan(0);
    expect(within(row).getAllByText("Hidden").length).toBeGreaterThan(0);
    // The words that say what was compared stay.
    expect(row).toHaveTextContent("Price difference in USD (sample value)");
  });

  it("still shows a quantity check's figures", async () => {
    const { quantity: row } = await checksAs("WAREHOUSE", true);
    expect(row).toHaveTextContent("120");
    expect(row).toHaveTextContent("108");
    expect(row).toHaveTextContent(
      "Quantity difference in units (sample value)",
    );
  });

  it("shows a role that works with pricing the prices", async () => {
    const { price: row } = await checksAs("SUPPORT", false);
    expect(row).toHaveTextContent("61.20");
    expect(row).toHaveTextContent("64.80");
  });
});

describe("what makes a check a price check", () => {
  it("reads the rule id, or the place the check read", () => {
    expect(isPriceCheck(price)).toBe(true);
    expect(
      isPriceCheck({ ...price, ruleId: "rule.unit-cost", evidence: [] }),
    ).toBe(true);
    expect(
      isPriceCheck({
        ...quantity,
        ruleId: "rule.other",
        evidence: [{ ...unitPricePlace, location: "header: total amount" }],
      }),
    ).toBe(true);
    expect(isPriceCheck(quantity)).toBe(false);
    expect(
      isPriceCheck({
        ...quantity,
        ruleId: "mock.sample-customer-no",
        evidence: [],
      }),
    ).toBe(false);
  });
});

const invoiceTotal: Check = {
  ...price,
  id: "total",
  ruleId: "rule.pi-total",
  ruleLabel: "Invoice total against the PI",
  expected: "7344.00",
  actual: "7776.00",
  tolerance: { label: "Difference allowed", value: "5.00" },
  evidence: [{ ...unitPricePlace, location: "header: total" }],
};

const totalQuantity: Check = {
  ...quantity,
  id: "total-quantity",
  ruleId: "rule.total-quantity",
  ruleLabel: "Total quantity against the PO",
  expected: "480",
  actual: "432",
  evidence: [{ ...unitPricePlace, location: "header: total quantity" }],
};

describe("a cover that fails closed", () => {
  it("covers a check on a total for a role whose prices are masked", async () => {
    const { byRule } = await checksWith(
      "WAREHOUSE",
      [invoiceTotal, totalQuantity],
      { masked: true },
    );
    const row = byRule(/Invoice total/);
    expect(row).not.toHaveTextContent(/7344|7776/);
    expect(within(row).getAllByText("Hidden").length).toBeGreaterThan(0);
  });

  it("shows a total quantity, which is a count and not money", async () => {
    const { byRule } = await checksWith(
      "WAREHOUSE",
      [invoiceTotal, totalQuantity],
      { masked: true },
    );
    const row = byRule(/Total quantity/);
    expect(row).toHaveTextContent("480");
    expect(row).toHaveTextContent("432");
  });

  it("covers a price check when the order's record has not answered", async () => {
    const { byRule, panel } = await checksWith("WAREHOUSE", [price, quantity], {
      masked: false,
      noRecord: true,
    });
    expect(byRule(/Unit price/)).not.toHaveTextContent(/61\.20|64\.80/);
    expect(panel.textContent).not.toMatch(/61\.20|64\.80/);
    expect(byRule(/Packing list quantity/)).toHaveTextContent("108");
  });

  it("shows Support every figure, a total included", async () => {
    const { byRule } = await checksWith("SUPPORT", [invoiceTotal, price], {
      masked: false,
    });
    expect(byRule(/Invoice total/)).toHaveTextContent("7344.00");
    expect(byRule(/Invoice total/)).toHaveTextContent("7776.00");
    expect(byRule(/Unit price/)).toHaveTextContent("64.80");
  });
});

describe("what makes a check a money check, in the words of the check", () => {
  it("reads the label, the tolerance label and the place, in any case", () => {
    const plain: Check = {
      ...quantity,
      ruleId: "rule.x",
      ruleLabel: "Check",
      evidence: [],
    };
    expect(isPriceCheck({ ...plain, ruleLabel: "Unit PRICE on the PI" })).toBe(
      true,
    );
    expect(
      isPriceCheck({
        ...plain,
        tolerance: { label: "Cost difference", value: "1" },
      }),
    ).toBe(true);
    expect(
      isPriceCheck({
        ...plain,
        evidence: [{ ...unitPricePlace, location: "header: Total" }],
      }),
    ).toBe(true);
    expect(isPriceCheck(totalQuantity)).toBe(false);
    // The word value does not make a check a money check.
    expect(isPriceCheck(quantity)).toBe(false);
  });
});
