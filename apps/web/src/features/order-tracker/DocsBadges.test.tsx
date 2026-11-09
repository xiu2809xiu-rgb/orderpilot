import { render, screen } from "@testing-library/react";
import type { TrackerOrder } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { axeViolations } from "@/test/axe";
import { docBadgesOf, DocsBadges } from "./DocsBadges";

const baseRow: TrackerOrder = {
  orderNo: "SO-0001",
  externalDocumentNo: "PO-1",
  customerNo: "C001",
  customerName: "Harbour Marine Supply",
  status: { code: "sample-po-received", label: "PO received" },
  ownerRole: "SUPPORT",
  overdue: { overdue: false, daysOverdue: 0, reason: null },
  openExceptions: 0,
  shipmentDate: null,
  orderDate: "2026-10-01",
};

describe("docBadgesOf", () => {
  it("marks only the documents a draft order's stage has reached", () => {
    expect(docBadgesOf(baseRow)).toEqual([
      { code: "P", state: "passed" },
      { code: "I", state: "pending" },
      { code: "L", state: "pending" },
      { code: "A", state: "pending" },
    ]);
  });

  it("marks every document passed once the order is shipped, clean", () => {
    const row: TrackerOrder = {
      ...baseRow,
      status: { code: "sample-shipped", label: "Shipped" },
    };
    expect(docBadgesOf(row).every((b) => b.state === "passed")).toBe(true);
  });

  it("fails the furthest-reached document, never an untouched one, when exceptions are open", () => {
    const row: TrackerOrder = {
      ...baseRow,
      status: { code: "sample-pi-to-send", label: "Proforma invoice to send" },
      openExceptions: 1,
    };
    // "processing" (this status's stage) reaches three documents (P, I, L).
    expect(docBadgesOf(row)).toEqual([
      { code: "P", state: "passed" },
      { code: "I", state: "passed" },
      { code: "L", state: "failed" },
      { code: "A", state: "pending" },
    ]);
  });

  it("never fabricates a failure when there are no open exceptions", () => {
    const row: TrackerOrder = { ...baseRow, openExceptions: 0 };
    expect(docBadgesOf(row).some((b) => b.state === "failed")).toBe(false);
  });

  it("never fabricates a failure for a status outside the five stages", () => {
    const row: TrackerOrder = {
      ...baseRow,
      status: { code: "unrecognised-status", label: "Unrecognised" },
      openExceptions: 3,
    };
    expect(docBadgesOf(row).every((b) => b.state === "pending")).toBe(true);
  });
});

describe("DocsBadges", () => {
  it("shows the four letters with an accessible name per state, and no axe violations", async () => {
    await i18n.loadNamespaces(["order-tracker"]);
    const row: TrackerOrder = {
      ...baseRow,
      status: { code: "sample-pi-to-send", label: "Proforma invoice to send" },
      openExceptions: 1,
    };
    const view = render(<DocsBadges row={row} />);
    expect(
      screen.getByLabelText("Packing list: mismatch flagged, 1 open exception"),
    ).toHaveTextContent("L");
    expect(screen.getByLabelText("Purchase order: passed")).toHaveTextContent(
      "P",
    );
    expect(
      screen.getByLabelText("Air waybill / shipping doc: not reached yet"),
    ).toHaveTextContent("A");
    expect(await axeViolations(view.container)).toEqual([]);
  });
});
