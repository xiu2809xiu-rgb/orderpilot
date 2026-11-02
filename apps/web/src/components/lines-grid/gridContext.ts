import { createContext, useContext, type ReactNode } from "react";
import type { LookupOption, LookupSearch } from "@/components/form";
import type { ColumnKind, LineColumn, PriceMask, Shortfall } from "./types";

/** What every line of one grid shares. It changes rarely, so lines can skip renders. */
export interface GridContextValue {
  name: string;
  columns: readonly LineColumn[];
  searchItems: LookupSearch;
  debounceMs: number;
  readOnly: boolean;
  priceMask: PriceMask | null;
  shortfallAction: ((shortfall: Shortfall) => ReactNode) | undefined;
  pick: (index: number, option: LookupOption) => void;
  remove: (index: number, from: ColumnKind | null) => void;
}

export const GridContext = createContext<GridContextValue | null>(null);

export function useGrid(): GridContextValue {
  const value = useContext(GridContext);
  if (value === null) throw new Error("A line must sit inside a LinesGrid.");
  return value;
}
