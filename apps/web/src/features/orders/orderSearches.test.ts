import type { ItemRow, Role } from "@orderpilot/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionStore } from "@/stores/session";
import { sessionFor } from "@/test/fixtures";
import { forgetKeptLists, searchItems } from "./orderSearches";

const items = vi.hoisted(() =>
  vi.fn<(params: { search?: string }) => Promise<unknown>>(),
);
const customers = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/generated/endpoints/master-data/master-data", () => ({
  masterDataItems: items,
  masterDataCustomers: customers,
}));

function row(no: string, description: string, price: string | null): ItemRow {
  return {
    no,
    description,
    partNumber: `PN-${no}`,
    brand: "Norvale",
    category: "PERIPHERALS",
    baseUnitOfMeasure: "PCS",
    inventory: "10",
    qtyOnSalesOrder: "0",
    qtyOnPurchOrder: "0",
    availableStock: "10",
    availability: "in_stock",
    unitPrice: { masked: price === null, value: price },
    vendorNo: "V-0001",
    vendorName: "Norvale Distribution",
  } as unknown as ItemRow;
}

function signInAs(role: Role) {
  useSessionStore.setState({ status: "active", session: sessionFor(role) });
}

const MONITOR = row("I-0009", "Norvale Monitor 27", "199.00");

/** The server's answer: the typed text finds nothing, the whole list holds the monitor. */
function serverHolds(...rows: ItemRow[]) {
  items.mockImplementation((params: { search?: string }) =>
    Promise.resolve({
      data: params.search === undefined ? rows : [],
      meta: { total: params.search === undefined ? rows.length : 0 },
    }),
  );
}

const wholeListCalls = () =>
  items.mock.calls.filter(([params]) => params.search === undefined).length;

beforeEach(() => {
  items.mockReset();
  customers.mockReset();
  forgetKeptLists();
  signInAs("SUPPORT");
});

describe("the possible matches kept for a minute", () => {
  it("offers a close name to a role whose prices are masked, and keeps no price field", async () => {
    serverHolds(row("I-0009", "Norvale Monitor 27", null));

    const found = await searchItems(
      "Norvale Monitr 27",
      new AbortController().signal,
    );

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ number: "I-0009", possible: true });
    expect("unitPrice" in (found[0] ?? {})).toBe(false);
  });

  it("holds no price for a role that may see prices either, since it is kept for the next role", async () => {
    serverHolds(MONITOR);

    const found = await searchItems(
      "Norvale Monitr 27",
      new AbortController().signal,
    );

    expect(found[0]).toMatchObject({ number: "I-0009", possible: true });
    expect("unitPrice" in (found[0] ?? {})).toBe(false);
  });

  it("keeps the price on an item the typed text found, as before", async () => {
    items.mockResolvedValue({ data: [MONITOR], meta: { total: 1 } });

    const found = await searchItems(
      "Norvale Monitor 27",
      new AbortController().signal,
    );

    expect(found[0]?.unitPrice).toEqual({ masked: false, value: "199.00" });
    expect(found[0]?.possible).toBeUndefined();
  });

  it("is read again from the server after the role changes", async () => {
    serverHolds(MONITOR);
    const signal = new AbortController().signal;

    await searchItems("Norvale Monitr 27", signal);
    await searchItems("Norvale Monitr 27", signal);
    expect(wholeListCalls()).toBe(1);

    forgetKeptLists();
    await searchItems("Norvale Monitr 27", signal);
    expect(wholeListCalls()).toBe(2);
  });

  it("is read again after a sign-out and a sign-in as someone else", async () => {
    serverHolds(MONITOR);
    const signal = new AbortController().signal;
    await searchItems("Norvale Monitr 27", signal);

    signInAs("PRODUCT_MANAGER");
    await searchItems("Norvale Monitr 27", signal);

    expect(wholeListCalls()).toBe(2);
  });
});
