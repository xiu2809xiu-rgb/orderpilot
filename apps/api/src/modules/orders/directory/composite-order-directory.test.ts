import { describe, expect, it } from "vitest";
import type { OrderFactsSource } from "../domain/order-directory.js";
import type { OrderFacts } from "../domain/order-facts.js";
import { CompositeOrderDirectory } from "./composite-order-directory.js";

function facts(orderNo: string, source: "sample" | "stored"): OrderFacts {
  return {
    orderNo,
    source,
    captureState: source === "stored" ? "draft" : null,
    customerNo: "C-10010",
    customerName: null,
    externalDocumentNo: "PO-1",
    orderDate: "2026-11-08",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "0.00",
    navisionNo: null,
    version: source === "stored" ? 1 : null,
    poVersionNo: source === "stored" ? 1 : null,
    workflowStatus: null,
    total: "0",
    lines: [],
    stockShortfall: null,
    overdue: null,
  };
}

function fake(rows: OrderFacts[], reads: string[] = []): OrderFactsSource {
  return {
    list: () => {
      reads.push("list");
      return Promise.resolve(rows);
    },
    find: (no) => Promise.resolve(rows.find((r) => r.orderNo === no) ?? null),
  };
}

const sample = facts("SO-0001", "sample");
const stored = facts("SO-20261108-0001", "stored");
const directory = new CompositeOrderDirectory(fake([sample]), fake([stored]));

describe("CompositeOrderDirectory", () => {
  it("lists the samples, then the stored orders", async () => {
    expect(await directory.list()).toEqual([sample, stored]);
  });

  it("reads only the kind that was asked for", async () => {
    const sampleReads: string[] = [];
    const storedReads: string[] = [];
    const counted = new CompositeOrderDirectory(
      fake([sample], sampleReads),
      fake([stored], storedReads),
    );
    expect(await counted.list({ source: "sample" })).toEqual([sample]);
    expect(storedReads).toEqual([]);
    expect(await counted.list({ source: "stored" })).toEqual([stored]);
    expect(sampleReads).toEqual(["list"]);
    expect(await counted.list({})).toEqual([sample, stored]);
  });

  it("sends a sample number to the samples and a record number to the stored orders", async () => {
    expect(await directory.find("SO-0001")).toBe(sample);
    expect(await directory.find("SO-20261108-0001")).toBe(stored);
  });

  it("does not look for a sample number among the stored orders, or the reverse", async () => {
    const swapped = new CompositeOrderDirectory(
      fake([facts("SO-20261108-0001", "sample")]),
      fake([facts("SO-0001", "stored")]),
    );
    expect(await swapped.find("SO-0001")).toBeNull();
    expect(await swapped.find("SO-20261108-0001")).toBeNull();
  });

  it("answers null for an unknown number of either kind", async () => {
    expect(await directory.find("SO-0999")).toBeNull();
    expect(await directory.find("SO-20990101-0001")).toBeNull();
    expect(await directory.find("nonsense")).toBeNull();
  });
});
