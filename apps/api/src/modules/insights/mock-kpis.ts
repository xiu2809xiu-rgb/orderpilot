import type { Kpi, KpiSet } from "@orderpilot/shared";
import type { SyntheticDataset } from "@orderpilot/synthetic-data";

/**
 * Spectra's five measures with placeholder lab estimates (see
 * docs/design-thinking/success-metrics.md). No protocol run has happened
 * (Q-7), so the numbers only make the dashboard readable. The definitions are
 * draft wording. The formulas, computed from events, are area 3's to write.
 * Each measure carries the dataset's twelve weekly values and target, and
 * its "with OrderPilot" figure is the latest week, so the screens agree with
 * the orders behind them.
 */
export function mockKpiSet(dataset: SyntheticDataset): KpiSet {
  const set = baseKpiSet();
  return {
    ...set,
    measures: set.measures.map((measure): Kpi => {
      const series = dataset.kpis.find((k) => k.id === measure.id);
      const latest = series?.weekly.at(-1)?.value;
      if (!series || latest === undefined) return measure;
      return {
        ...measure,
        manual: series.manual,
        withOrderPilot: latest,
        target: series.target,
        weekly: series.weekly.map((w) => ({ ...w })),
      };
    }),
  };
}

function baseKpiSet(): KpiSet {
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
