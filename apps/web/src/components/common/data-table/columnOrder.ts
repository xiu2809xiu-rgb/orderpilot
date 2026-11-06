import type { DataTableColumn } from "./types";

/**
 * The columns in the viewer's order. A column that cannot be hidden (the
 * record number) keeps its declared place, and the others fill the remaining
 * places in the order the viewer chose. A column the saved order does not know,
 * such as one added since, comes after the known ones, in declared order.
 */
export function arrangeColumns<Row>(
  columns: readonly DataTableColumn<Row>[],
  order: readonly string[] | null,
): DataTableColumn<Row>[] {
  if (!order) return [...columns];
  const rank = new Map(order.map((id, index) => [id, index]));
  const movable = columns
    .filter((column) => column.hideable !== false)
    .map((column, declared) => ({
      column,
      rank: rank.get(column.id) ?? order.length + declared,
    }))
    .toSorted((a, b) => a.rank - b.rank)
    .map((entry) => entry.column);
  let next = 0;
  return columns.map((column) =>
    column.hideable === false ? column : (movable[next++] ?? column),
  );
}

/** The ids of the columns a viewer may move, in the order they are shown. */
export function movableIds<Row>(
  columns: readonly DataTableColumn<Row>[],
): string[] {
  return columns
    .filter((column) => column.hideable !== false)
    .map((column) => column.id);
}

/** The order after moving one column a place up (-1) or down (1). */
export function moveColumn(
  ids: readonly string[],
  id: string,
  by: -1 | 1,
): string[] {
  const from = ids.indexOf(id);
  const to = from + by;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}
