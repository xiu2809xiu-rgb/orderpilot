import type { ReactNode } from "react";
import { z } from "zod";
import { decimalStringSchema } from "@orderpilot/shared";
import type { MaskReason } from "@/components/common";
import type { LookupValue } from "@/components/form";

/** What the grid keeps for a line. A screen's schema may hold more beside it. */
export interface LineValue {
  /**
   * Names the line for good, wherever it moves. A draft matches restored rows
   * on it, so a deleted line can never hand its neighbour a price. A saved line
   * brings its own; a new one gets one from `emptyLine`.
   */
  lineId: string;
  item: LookupValue | null;
  description: string;
  /** A decimal string, so that an empty cell stays empty. */
  quantity: string;
  /** A decimal string; empty when the role may not see prices. */
  unitPrice: string;
  /** The item's unit of measure, such as "PCS". */
  unit: string;
  /** As the API reports it, or null while it is not known. */
  availableStock: string | null;
  /**
   * What this order's customer last paid for the item, shown as context when
   * the grid is in `itemPrice: "reference"` mode. "none" means the customer
   * never bought it, and "unknown" that the lookup failed. It is never a
   * price of the line.
   */
  lastPrice?: LastPrice | "none" | "unknown" | null | undefined;
  /**
   * Where the price came from, for a grid in `itemPrice: "agreed"` mode. A
   * price the grid filled (the item's list price, then what the customer last
   * agreed) can still be replaced by a better one; a price the person typed
   * never is. `list` keeps the item's list price, to go back to.
   */
  priceFrom?: PriceFrom | null | undefined;
}

export interface PriceFrom {
  source: "item" | "agreed" | "typed";
  /** The item the price was set for. Empty when typed before any item. */
  itemNo: string;
  list: string;
}

/** The price a customer last paid for an item, and the document it was on. */
export const lastPriceSchema = z.object({
  price: z.string(),
  agreedOn: z.string(),
  documentNo: z.string(),
});
export type LastPrice = z.infer<typeof lastPriceSchema>;

/** What picking an item does to the price. See `LinesGridProps.itemPrice`. */
export type ItemPriceMode = "fill" | "reference" | "agreed";

/** A record the item lookup found, with what picking it fills in. */
export const itemOptionSchema = z.object({
  number: z.string(),
  name: z.string(),
  detail: z.string().optional(),
  /** A look-alike name the search did not find by its text. See `LookupOption`. */
  possible: z.boolean().optional(),
  description: z.string().optional(),
  unit: z.string().optional(),
  /** Inventory minus open sales demand plus open purchases, by the API's formula. */
  availableStock: decimalStringSchema.optional(),
  /** The selling price as the API sends it: masked for roles that do not quote it. */
  unitPrice: z
    .object({ masked: z.boolean(), value: z.string().nullable() })
    .optional(),
});
export type ItemOption = z.infer<typeof itemOptionSchema>;

/** Finds items. It must stop when `signal` aborts. */
export type ItemSearch = (
  query: string,
  signal: AbortSignal,
) => Promise<readonly ItemOption[]>;

export const COLUMN_KINDS = [
  "lineNo",
  "item",
  "description",
  "quantity",
  "unitPrice",
  "amount",
  "availability",
  "remove",
] as const;
export type ColumnKind = (typeof COLUMN_KINDS)[number];

/**
 * One column of a grid. A screen lists the columns it wants, in order: an order
 * has all of them, an SPR leaves out the prices. `header` is already worded.
 */
export interface LineColumn {
  kind: ColumnKind;
  header: string;
  /** A CSS grid track such as "7rem" or "minmax(0, 2fr)". Each kind has a default. */
  width?: string;
  /** Shown but not editable, such as a description that comes from the item. */
  readOnly?: boolean;
}

/** Prices are hidden from this role: the grid shows the mask and why. */
export interface PriceMask {
  reason: MaskReason;
  /** Who may see them, in words. */
  visibleTo?: string;
}

/** What a footer shows. The grid computes it once and hands it over as one value. */
export interface LineTotals {
  lineCount: number;
  /** Sum of the quantities that are numbers so far. */
  quantity: string;
  /** Null when the grid has no amount column, or the role may not see amounts. */
  amount: string | null;
  masked: PriceMask | null;
  /** True while these are the server's figures, not the browser's. */
  fromServer: boolean;
}

/** The totals the server computed on its last answer. They win until a line changes. */
export interface ServerTotals {
  quantity?: string;
  amount?: string;
}

/** A line that asks for more than the item has available. */
export interface Shortfall {
  index: number;
  lineId: string;
  itemNo: string;
  needed: string;
  available: string;
  shortBy: string;
}

export interface LinesGridProps {
  /** The form's field array. Default "lines". */
  name?: string;
  columns: readonly LineColumn[];
  searchItems: ItemSearch;
  /** Names the table for a screen reader: "Order lines". */
  label: string;
  readOnly?: boolean;
  priceMask?: PriceMask | null;
  /**
   * What picking an item does to the price. "fill" (the default) starts the
   * line at the item's Unit Price. "reference" leaves the price empty for the
   * person to type, and shows the customer's last agreed price beside it as
   * context (written by the screen), for a screen where a document sets the
   * price (an order's PO). "agreed" starts at the list price like "fill", and
   * shows the last agreed price like "reference"; the screen then writes it,
   * and the screen swaps it in for a price nobody typed.
   */
  itemPrice?: ItemPriceMode;
  /** Draws the footer from the totals. The default shows lines, quantity and total. */
  footer?: (totals: LineTotals) => ReactNode;
  serverTotals?: ServerTotals;
  /** A slot beside a shortfall, such as a Raise SPR button. */
  shortfallAction?: (shortfall: Shortfall) => ReactNode;
  /** Makes the first values of a new line, when a screen needs more than the default. */
  newLine?: () => LineValue;
  /** How long the item lookup waits for typing to pause. */
  debounceMs?: number;
}
