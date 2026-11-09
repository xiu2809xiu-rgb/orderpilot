import {
  ORDER_CAPTURE_STATES,
  ORDER_SOURCES,
  ORDER_SORT_COLUMNS,
} from "@orderpilot/shared";
import { rangeSpec } from "@/components/common";

/**
 * The filters the address may carry. `stock` allows the one value `waiting`,
 * so that a text filter is never read back as a switch that is on.
 */
export const URL_FILTERS = {
  customerNo: null,
  captureState: ORDER_CAPTURE_STATES,
  source: ORDER_SOURCES,
  stock: ["waiting"],
  ...rangeSpec("orderDate"),
} as const;

/** The columns the server can sort by: every other column is for reading. */
export const SORTABLE: readonly string[] = ORDER_SORT_COLUMNS;
