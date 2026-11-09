import { describe, expect, it } from "vitest";
import {
  SAMPLE_SCREEN_STATES,
  createSyntheticDataset,
  type SyntheticDataset,
} from "./index.js";

// Pins what the live sample set looked like before the briefing data: every
// order keeps its number, state, age and SPR and PI numbers, and the first 40
// customers keep their kept fields. Later stories add customers, items and
// history beside it, and must not move these.

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function stateRanks(dataset: SyntheticDataset): string {
  return dataset.orders
    .map((order) =>
      SAMPLE_SCREEN_STATES.indexOf(order.sampleScreenState).toString(12),
    )
    .join("");
}

function agesAndNumbers(dataset: SyntheticDataset): string {
  const parts = dataset.orders.map((order) => {
    const pis = order.documents
      .filter((doc) => doc.type === "PROFORMA_INVOICE")
      .map((doc) => doc.number ?? "-")
      .join(",");
    return `${order.header.no}|${String(order.ageDays)}|${pis}`;
  });
  const sprs = dataset.sprs.map(
    (spr) => `${spr.recordNo}|${spr.navisionNo ?? "-"}|${spr.orderNo}`,
  );
  return [...parts, ...sprs].join("\n");
}

function firstCustomers(dataset: SyntheticDataset): string {
  return dataset.customers
    .filter((customer) => Number(customer.no.slice(2)) <= 40)
    .map((customer) =>
      [
        customer.no,
        customer.name,
        customer.countryRegionCode,
        customer.currencyCode,
        customer.paymentTermsCode,
        customer.creditLimitLcy,
        customer.balanceLcy,
      ].join("|"),
    )
    .join("\n");
}

describe("the 120 live sample orders stay where they are", () => {
  const dataset = createSyntheticDataset();

  it("keeps every order's state, in order of SO number", () => {
    expect(dataset.orders).toHaveLength(120);
    expect(stateRanks(dataset)).toBe(
      "bbabaaaabbbbbabbbababb9889989898999a997a77977598665766666666655556654336555533443225443332225435422111421322022111100000",
    );
  });

  it("keeps every order's age and every SPR and PI number", () => {
    expect(fnv1a(agesAndNumbers(dataset))).toBe("becbae1f");
  });

  it("keeps the first 40 customers", () => {
    expect(fnv1a(firstCustomers(dataset))).toBe("23f3376c");
  });
});
