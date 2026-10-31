import {
  DEFAULT_DOCUMENT_CONFIG,
  DEMO_PERSONAS,
  addDecimal,
  multiplyDecimal,
  type DocumentTypeConfig,
  type SprDetail,
  type SprField,
} from "@orderpilot/shared";
import type { Item, SyntheticDataset } from "@orderpilot/synthetic-data";
import { SprSuggestion } from "../domain/spr-suggestion.js";
import { MOCK_NOW, addDays } from "./fixtures.js";
import { MOCK_SPR_REFS } from "./mock-tasks.js";

/** An SPR as the read model holds it. The approver is added by the service, from area 4's policy. */
export type SprRecord = Omit<SprDetail, "approver" | "substituteName">;

interface SprPlan {
  readonly orderNo: string;
  readonly itemNo: string;
  /** What the order wants. Null: work it out so the stock falls short by `shortBy`. */
  readonly ordered: string | null;
  readonly shortBy: string;
  readonly notes: string;
  readonly decided: boolean;
}

const PLANS: readonly SprPlan[] = [
  {
    orderNo: "SO-0003",
    itemNo: "I-0008",
    ordered: "120",
    shortBy: "0",
    notes: "",
    decided: false,
  },
  {
    orderNo: "SO-0005",
    itemNo: "I-0021",
    ordered: null,
    shortBy: "60",
    notes: "Keeps the safety stock for the distributor accounts.",
    decided: false,
  },
  {
    orderNo: "SO-0009",
    itemNo: "I-0010",
    ordered: null,
    shortBy: "40",
    notes: "",
    decided: true,
  },
];

function fieldsOf(
  config: DocumentTypeConfig,
  suggested: Record<string, string>,
  notes: string,
): SprField[] {
  return config.fields
    .filter((field) => field.visible)
    .map((field) => {
      const fromStock = suggested[field.key];
      const base = {
        key: field.key,
        label: field.label,
        required: field.required,
      };
      if (fromStock !== undefined) {
        return { ...base, value: fromStock, origin: "suggested" as const };
      }
      if (field.defaultValue !== null) {
        return {
          ...base,
          value: field.defaultValue,
          origin: "default" as const,
        };
      }
      return {
        ...base,
        value: field.key === "notes" ? notes : "",
        origin: "person" as const,
      };
    });
}

function recordOf(
  plan: SprPlan,
  item: Item,
  vendorName: string,
  config: DocumentTypeConfig,
): SprRecord | null {
  const available = SprSuggestion.availableStock(item);
  const ordered = plan.ordered ?? addDecimal(available, plan.shortBy);
  const basis = SprSuggestion.fromShortfall({
    ordered,
    inventory: item.inventory,
    qtyOnSalesOrder: item.qtyOnSalesOrder,
    qtyOnPurchOrder: item.qtyOnPurchOrder,
  });
  const ref = MOCK_SPR_REFS[plan.orderNo];
  if (!basis || !ref) return null;
  const requestedAt = plan.decided
    ? "2026-10-27T02:00:00.000Z"
    : MOCK_NOW.toISOString();
  return {
    ref,
    orderNo: plan.orderNo,
    requestedBy: {
      name: DEMO_PERSONAS.PRODUCT_MANAGER,
      role: "PRODUCT_MANAGER",
    },
    requestedAt,
    vendor: { no: item.vendorNo, name: vendorName },
    item: { no: item.no, description: item.description },
    quantity: basis.shortfall,
    unitCost: item.unitCost,
    amount: multiplyDecimal(basis.shortfall, item.unitCost),
    currencyCode: "USD",
    basis,
    fields: fieldsOf(
      config,
      {
        vendorNo: item.vendorNo,
        itemNo: item.no,
        quantity: basis.shortfall,
        needBy: addDays(requestedAt.slice(0, 10), 14),
      },
      plan.notes,
    ),
    decision: plan.decided
      ? {
          outcome: "approved",
          by: DEMO_PERSONAS.APPROVER,
          comment: "Within my limit and the vendor confirmed the lead time.",
          at: "2026-10-27T05:30:00.000Z",
        }
      : null,
  };
}

export function buildSprs(dataset: SyntheticDataset): SprRecord[] {
  const config = DEFAULT_DOCUMENT_CONFIG.find(
    (entry) => entry.documentType === "SPR",
  );
  if (!config) return [];
  return PLANS.flatMap((plan) => {
    const item = dataset.items.find((entry) => entry.no === plan.itemNo);
    const vendor = dataset.vendors.find((entry) => entry.no === item?.vendorNo);
    if (!item || !vendor) return [];
    const record = recordOf(plan, item, vendor.name, config);
    return record ? [record] : [];
  });
}
