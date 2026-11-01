import type { Item } from "@orderpilot/synthetic-data";
import { PO_LAYOUTS, type LayoutId } from "./model.js";

export const CONTACTS = [
  "Anjelika Verrow",
  "Tomas Quillane",
  "Marisol Dunreith",
  "Kabir Ostrand",
  "Leilani Marchetti",
  "Dariusz Penhallow",
  "Imara Tolliver",
  "Rostam Fairweather",
] as const;

export const TERMS: Readonly<Record<string, string>> = {
  "30 DAYS": "Net 30 days from invoice date",
  "60 DAYS": "Net 60 days from invoice date",
  PREPAID: "100% advance payment before shipment",
  "50% ADVANCE": "50% advance with order, balance before shipment",
  "30% DEPOSIT": "30% deposit with order, balance before shipment",
  "LC AT SIGHT": "Irrevocable letter of credit at sight",
};

export const CREDIT_DAYS: Readonly<Record<string, number>> = {
  "30 DAYS": 30,
  "60 DAYS": 60,
};

// Pieces and kilograms in a carton, by what is inside it.
export const CARTON: Readonly<
  Record<Item["category"], { pieces: number; kg: number }>
> = {
  IT: { pieces: 10, kg: 12 },
  SURVEILLANCE: { pieces: 5, kg: 9.5 },
  ACCESSORIES: { pieces: 50, kg: 8 },
};

/**
 * Which look a customer's PO has. The customer number picks it, so a customer
 * always sends the same one. The spread by five then four keeps neighbouring
 * customers apart and gives the first customers all four looks.
 */
export function layoutForCustomer(customerNo: string): LayoutId {
  const n = Number(customerNo.slice(2)) - 1;
  return PO_LAYOUTS[(n % 5) % PO_LAYOUTS.length] ?? "boxed";
}
