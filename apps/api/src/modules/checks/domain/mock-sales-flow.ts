import type { SalesFlowStepId } from "@orderpilot/shared";
import type { SampleScreenState } from "@orderpilot/synthetic-data";

export interface MockFlowStep {
  readonly id: SalesFlowStepId;
  readonly statuses: readonly SampleScreenState[];
}

/**
 * Which of the synthetic data's sample states sit at which of the brief's nine
 * sales steps. Every state but `sample-closed` is here exactly once, so the
 * steps add up to the open orders. The steps follow the brief's order, where
 * the AWB and the permit are followed up last. The states are fixture labels,
 * not order statuses: this table goes when area 2's state machine reports the
 * real step.
 */
export const MOCK_SALES_FLOW: readonly MockFlowStep[] = [
  {
    id: "poIn",
    statuses: ["sample-po-received", "sample-extracted-awaiting-review"],
  },
  { id: "stock", statuses: ["sample-short-stock", "sample-pending-approval"] },
  { id: "pi", statuses: ["sample-pi-to-send"] },
  { id: "payment", statuses: ["sample-awaiting-payment"] },
  { id: "pack", statuses: ["sample-ready-to-pick"] },
  { id: "documents", statuses: ["sample-packing-list-mismatch"] },
  { id: "forwarder", statuses: ["sample-shipped"] },
  { id: "customerTold", statuses: ["sample-invoiced"] },
  { id: "awbAndPermit", statuses: ["sample-awb-overdue"] },
];
