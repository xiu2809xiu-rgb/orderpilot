import type { MaskedField, Role } from "@orderpilot/shared";
import { SAMPLE_RULES, mask } from "../../governance/domain/masking.js";

/**
 * What a role may see of an order's money. Prices have one rule, so an amount
 * borrows the selling price's: Warehouse and Logistics never price anything.
 * Area 4 may give amounts a rule of their own; only this class changes then.
 */
export class OrderMasking {
  private static readonly FIELD = "item.unitPrice";

  amount(role: Role, value: string): MaskedField {
    return mask(SAMPLE_RULES, role, OrderMasking.FIELD, value);
  }

  /** False when the role cannot see amounts, so they cannot filter or sort by them either. */
  canSeeAmount(role: Role): boolean {
    return !this.amount(role, "0").masked;
  }
}
