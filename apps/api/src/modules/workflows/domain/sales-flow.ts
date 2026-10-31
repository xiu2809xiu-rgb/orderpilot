import type { Role } from "@orderpilot/shared";

export interface StepDefinition {
  /** Stable key. The web app's text for the step is keyed by it. */
  readonly key: string;
  /** English label, for API text such as a timeline line. */
  readonly label: string;
  readonly ownerRole: Role;
  /** Only some orders pass through it, such as SPR approval. */
  readonly optional: boolean;
}

/**
 * The sales flow's steps as a list, for the steps screen and for the config
 * the seed stores in WorkflowDefinition. It holds the keys, the labels and who
 * owns each step, and nothing about how an order moves: no transitions, no
 * guards and no due dates. All of that is Azri's state machine (C-2).
 */
export const STARTER_SALES_STEPS: readonly StepDefinition[] = [
  {
    key: "po-received",
    label: "PO received",
    ownerRole: "SUPPORT",
    optional: false,
  },
  {
    key: "fields-confirmed",
    label: "Fields confirmed",
    ownerRole: "SUPPORT",
    optional: false,
  },
  {
    key: "stock-checked",
    label: "Stock checked",
    ownerRole: "PRODUCT_MANAGER",
    optional: false,
  },
  {
    key: "spr-approval",
    label: "SPR approval",
    ownerRole: "APPROVER",
    optional: true,
  },
  {
    key: "pi-sent",
    label: "Pro forma invoice sent",
    ownerRole: "SUPPORT",
    optional: false,
  },
  {
    key: "payment-confirmed",
    label: "Payment confirmed",
    ownerRole: "FINANCE",
    optional: false,
  },
  { key: "packed", label: "Packed", ownerRole: "WAREHOUSE", optional: false },
  { key: "invoiced", label: "Invoiced", ownerRole: "FINANCE", optional: false },
  {
    key: "shipping-documents",
    label: "Shipping documents",
    ownerRole: "LOGISTICS",
    optional: false,
  },
];

export function stepLabel(key: string): string {
  return STARTER_SALES_STEPS.find((step) => step.key === key)?.label ?? key;
}

export const SALES_FLOW_KEY = "sales-order";
export const SALES_FLOW_VERSION = 1;
