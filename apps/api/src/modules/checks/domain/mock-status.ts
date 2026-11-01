import type { ReportedStatus, Role } from "@orderpilot/shared";
import type { SampleScreenState } from "@orderpilot/synthetic-data";

/**
 * Words and owner for each of the synthetic data's sample states. The sample
 * states are labels for demo screens, not order statuses: area 2's state
 * machine owns the real ones, and this table goes when its API replaces the
 * mock reader. The step order below also drives the mock timeline.
 */
export interface SampleStep {
  readonly state: SampleScreenState;
  readonly status: ReportedStatus;
  readonly ownerRole: Role;
  readonly actor: string;
  readonly title: string;
  readonly effect: string;
}

function step(
  state: SampleScreenState,
  label: string,
  ownerRole: Role,
  actor: string,
  title: string,
  effect: string,
): SampleStep {
  return {
    state,
    status: { code: state, label },
    ownerRole,
    actor,
    title,
    effect,
  };
}

export const SAMPLE_STEPS: readonly SampleStep[] = [
  step(
    "sample-po-received",
    "PO received",
    "SUPPORT",
    "System",
    "Customer PO received",
    "An order record is opened. Nothing is posted yet",
  ),
  step(
    "sample-extracted-awaiting-review",
    "Fields awaiting review",
    "SUPPORT",
    "System",
    "Fields read from the PO",
    "A person confirms the fields before the order moves on",
  ),
  step(
    "sample-short-stock",
    "Short on stock",
    "PRODUCT_MANAGER",
    "Support",
    "Stock checked against the order",
    "A shortage is shown and a purchase request is suggested",
  ),
  step(
    "sample-pending-approval",
    "Waiting for approval",
    "APPROVER",
    "Product manager",
    "Stock purchase request raised",
    "Approval is requested before the order goes on",
  ),
  step(
    "sample-pi-to-send",
    "Proforma invoice to send",
    "SUPPORT",
    "Approver",
    "Stock covered",
    "The proforma invoice is drafted and waits to be checked and sent",
  ),
  step(
    "sample-awaiting-payment",
    "Waiting for payment",
    "FINANCE",
    "Support",
    "Proforma invoice sent",
    "Packing waits for the prepayment",
  ),
  step(
    "sample-ready-to-pick",
    "Ready to pick",
    "WAREHOUSE",
    "Finance",
    "Payment confirmed",
    "Payment confirmed: packing released, the warehouse can pick",
  ),
  step(
    "sample-packing-list-mismatch",
    "Packing list differs from the PO",
    "WAREHOUSE",
    "System",
    "Packing list checked against the PO",
    "A quantity differs. The result goes to the workflow, which decides what it holds up",
  ),
  step(
    "sample-awb-overdue",
    "Shipped, AWB overdue",
    "LOGISTICS",
    "Warehouse",
    "Goods shipped",
    "The shipment is posted in Navision. The AWB is not here yet",
  ),
  step(
    "sample-shipped",
    "Shipped",
    "LOGISTICS",
    "Logistics",
    "AWB recorded",
    "The tracking number is on the order and the customer can follow the shipment",
  ),
  step(
    "sample-invoiced",
    "Invoiced",
    "FINANCE",
    "Navision",
    "Sales invoice posted in Navision",
    "Receivables are raised in Navision. OrderPilot only shows the result",
  ),
  step(
    "sample-closed",
    "Closed",
    "FINANCE",
    "Finance",
    "Balance received",
    "Nothing is left to do. The order stays in the record",
  ),
];

export function sampleStepFor(state: SampleScreenState): SampleStep {
  const found = SAMPLE_STEPS.find((entry) => entry.state === state);
  if (!found) throw new RangeError(`No sample step for ${state}`);
  return found;
}
