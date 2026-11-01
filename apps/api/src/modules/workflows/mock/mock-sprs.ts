import {
  DEFAULT_DOCUMENT_CONFIG,
  type DocumentTypeConfig,
  type SprDetail,
  type SprField,
} from "@orderpilot/shared";
import type {
  Item,
  SampleSpr,
  SyntheticDataset,
} from "@orderpilot/synthetic-data";

/** An SPR as the read model holds it. The approver is added by the service, from area 4's policy. */
export type SprRecord = Omit<SprDetail, "approver" | "substituteName">;

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
  spr: SampleSpr,
  item: Item,
  vendorName: string,
  config: DocumentTypeConfig,
): SprRecord {
  return {
    ref: { recordNo: spr.recordNo, navisionNo: spr.navisionNo },
    orderNo: spr.orderNo,
    requestedBy: { name: spr.requestedBy, role: "PRODUCT_MANAGER" },
    requestedAt: spr.requestedAt,
    vendor: { no: item.vendorNo, name: vendorName },
    item: { no: item.no, description: item.description },
    quantity: spr.quantity,
    unitCost: spr.unitCost,
    amount: spr.amount,
    currencyCode: "USD",
    basis: spr.basis,
    fields: fieldsOf(
      config,
      {
        vendorNo: item.vendorNo,
        itemNo: item.no,
        quantity: spr.quantity,
        needBy: spr.needBy,
      },
      spr.notes,
    ),
    decision: spr.decision ? { ...spr.decision } : null,
  };
}

/** Every SPR in the dataset in the shape the routes answer with. */
export function buildSprs(dataset: SyntheticDataset): SprRecord[] {
  const config = DEFAULT_DOCUMENT_CONFIG.find(
    (entry) => entry.documentType === "SPR",
  );
  if (!config) return [];
  const items = new Map(dataset.items.map((item) => [item.no, item]));
  const vendors = new Map(dataset.vendors.map((v) => [v.no, v.name]));
  return dataset.sprs.flatMap((spr) => {
    const item = items.get(spr.itemNo);
    const vendorName = vendors.get(spr.vendorNo);
    return item && vendorName ? [recordOf(spr, item, vendorName, config)] : [];
  });
}
