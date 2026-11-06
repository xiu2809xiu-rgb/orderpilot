import type { OperationLogEntity, Permission } from "@orderpilot/shared";
import type { LucideIcon } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

/**
 * One filter a list offers. A select needs `options`. A lookup is a select
 * with a search box, for a long list such as customers or vendors. A toggle is
 * a yes/no switch such as "Overdue only". A range is two dates: it keeps
 * `idFrom` and `idTo` (see `rangeSpec`). `more` puts it under More filters,
 * so the bar keeps to the three or four that matter.
 *
 * Every id, or both of a range's, must also be in the list's `useUrlQuery`
 * spec. The page checks this in development and says which one is missing.
 */
export interface ListFilter {
  id: string;
  label: string;
  kind?: "select" | "lookup" | "toggle" | "range";
  options?: readonly FilterOption[];
  /** The first option of a select, such as "All brands". */
  allLabel?: string;
  more?: boolean;
  /**
   * Says a value in words when the options cannot, such as a link that asks
   * for several statuses at once. The chip and the select use it.
   */
  describe?: (value: string) => string;
}

/**
 * The kinds of action, in the order the bar draws them. Export and Print are
 * done by the template; the others call `onRun`. View and Copy are for one
 * row, so only the row menu offers them; Edit, Void and Disable are in both.
 */
export const ACTION_KINDS = [
  "new",
  "edit",
  "void",
  "disable",
  "batch",
  "import",
  "export",
  "print",
  "view",
  "copy",
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

/** What an action needs selected before it can run. */
export type ActionNeeds = "none" | "one" | "many";

/** The words and the work of a Void or Disable, which always asks for a reason. */
export interface ReasonedAction<Row> {
  title: string;
  description?: string;
  confirmLabel: string;
  /** The toast that ends the action, for example "Customer C-0001 voided". */
  doneMessage: (rows: readonly Row[]) => string;
  /** Sends the reason with the selected rows. A throw lands on the reason field. */
  run: (rows: readonly Row[], reason: string) => Promise<unknown>;
}

export interface ListAction<Row> {
  id: string;
  kind: ActionKind;
  /** Already translated. Export, Print, Import and the rest have a default. */
  label?: string;
  icon?: LucideIcon;
  /** The role must hold it, or the button is not drawn at all. */
  permission: Permission;
  /** Defaults by kind: Edit and Void act on one row, batch on many, the rest on none. */
  needs?: ActionNeeds;
  /**
   * Says why the selected rows cannot take this action, already translated, or
   * returns undefined when they can: for example "Only SPRs waiting for
   * approval can be approved." The button then stays reachable and gives the
   * reason, as it does when nothing is selected.
   */
  enabledFor?: (rows: readonly Row[]) => string | undefined;
  /** Runs the action with the selected rows, or with the one row of a row menu. */
  onRun?: (rows: readonly Row[]) => void;
  /** For Void and Disable: the template asks for a reason, then runs this. */
  reasoned?: ReasonedAction<Row>;
}

/**
 * One page of every row the filter shows, as the generated call returns it,
 * such as `(page) => masterDataItems({ ...params, page, pageSize: 200 })`.
 */
export type LoadPage<Row> = (
  page: number,
) => Promise<{ data: readonly Row[]; meta: { total: number } }>;

/** What a list page needs from the query hook that fetched it. */
export interface ListResult<Row> {
  data?: { data: readonly Row[]; meta: { total: number } } | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * The operation log under a list: the selected record's who, when and what.
 * `entityType` is the kind as the audit writer names it; the role must be able
 * to read that kind of record (OPERATION_LOG_READERS), or no panel is drawn.
 */
export interface OperationLogSpec<Row> {
  entityType: OperationLogEntity;
  /** The record's id as the audit writer stored it. */
  entityId: (row: Row) => string;
}

const DEFAULT_NEEDS: Record<ActionKind, ActionNeeds> = {
  new: "none",
  edit: "one",
  void: "one",
  disable: "one",
  batch: "many",
  import: "none",
  export: "none",
  print: "none",
  view: "one",
  copy: "one",
};

export function needsOf<Row>(action: ListAction<Row>): ActionNeeds {
  return action.needs ?? DEFAULT_NEEDS[action.kind];
}
