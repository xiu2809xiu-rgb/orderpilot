import type { KpiSet } from "@orderpilot/shared";

/**
 * Spectra's five measures with placeholder lab estimates (see
 * docs/design-thinking/success-metrics.md). No protocol run has happened
 * (Q-7), so the numbers only make the dashboard readable. The definitions are
 * draft wording. The formulas, computed from events, are area 3's to write.
 */
export function mockKpiSet(): KpiSet {
  return {
    labEstimate: true,
    note: "Mock lab estimates on synthetic data. Spectra has not given real numbers yet.",
    measures: [
      {
        id: "processingTime",
        label: "Order-processing time",
        unit: "minutes per order",
        manual: 42,
        withOrderPilot: 14,
        lowerIsBetter: true,
        definition:
          "Minutes of staff work per step, from PO received to goods released.",
      },
      {
        id: "manualTouches",
        label: "Manual touches per order",
        unit: "touches",
        manual: 18,
        withOrderPilot: 6,
        lowerIsBetter: true,
        definition:
          "Hand-typed or hand-corrected fields, plus hand-offs between groups.",
      },
      {
        id: "dataEntryErrors",
        label: "Data-entry errors",
        unit: "per 100 fields",
        manual: 5,
        withOrderPilot: 1,
        lowerIsBetter: true,
        definition:
          "Confirmed values that differ from the truth, per 100 fields.",
      },
      {
        id: "approvalTurnaround",
        label: "Approval turnaround",
        unit: "hours",
        manual: 20,
        withOrderPilot: 5,
        lowerIsBetter: true,
        definition: "Hours between an SPR being raised and decided.",
      },
      {
        id: "overdueOrders",
        label: "Overdue orders",
        unit: "orders",
        manual: 8,
        withOrderPilot: 3,
        lowerIsBetter: true,
        definition: "Orders late on any step, counted by step and owner.",
      },
    ],
  };
}
