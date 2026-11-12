import type { LineFields } from "./fields.js";
import { fieldId, type FieldSpec } from "./model.js";

const LINE_KEYS = {
  partNumber: "partNumber",
  description: "description",
  quantity: "quantity",
  unitPrice: "unitPrice",
  amount: "amount",
  cartons: "cartons",
  grossWeight: "grossWeight",
  vendorItemNo: "vendorItemNo",
  netWeight: "netWeight",
} as const satisfies Record<keyof LineFields, string>;

/** Every field a document carries, in reading order. A layout places what the book holds. */
export class FieldBook {
  constructor(readonly specs: readonly FieldSpec[]) {}

  find(key: string, lineIndex: number | null = null): FieldSpec | null {
    return (
      this.specs.find((s) => s.key === key && s.lineIndex === lineIndex) ?? null
    );
  }

  /** Throws on a key the kind does not have: that is a bug in its layout, not a missing value. */
  get(key: string, lineIndex: number | null = null): FieldSpec {
    const found = this.find(key, lineIndex);
    if (!found) throw new Error(`No field ${fieldId(key, lineIndex)}`);
    return found;
  }

  /** The line cells in the shape the table drawer takes; null for a column the kind lacks. */
  lineSpecs(): LineFields[] {
    const indexes = [
      ...new Set(
        this.specs
          .filter((s) => s.lineIndex !== null)
          .map((s) => s.lineIndex ?? 0),
      ),
    ].sort((a, b) => a - b);
    return indexes.map((i) => {
      const cell = (name: keyof LineFields): FieldSpec | null =>
        this.find(`lines.${LINE_KEYS[name]}`, i);
      const need = (name: keyof LineFields): FieldSpec =>
        cell(name) ?? this.get(`lines.${name}`, i);
      return {
        partNumber: need("partNumber"),
        description: need("description"),
        quantity: need("quantity"),
        unitPrice: cell("unitPrice"),
        amount: cell("amount"),
        cartons: cell("cartons"),
        grossWeight: cell("grossWeight"),
        vendorItemNo: cell("vendorItemNo"),
        netWeight: cell("netWeight"),
      };
    });
  }
}
