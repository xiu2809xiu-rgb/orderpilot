import { describe, expect, it } from "vitest";
import { arrangeColumns, movableIds, moveColumn } from "./columnOrder";
import type { DataTableColumn } from "./types";

const col = (id: string, hideable = true): DataTableColumn<unknown> => ({
  id,
  header: id,
  cell: () => id,
  hideable,
});

const COLUMNS = [col("no", false), col("a"), col("b"), col("c")];
const ids = (columns: readonly DataTableColumn<unknown>[]) =>
  columns.map((column) => column.id);

describe("the viewer's column order", () => {
  it("keeps the declared order until the viewer chooses one", () => {
    expect(ids(arrangeColumns(COLUMNS, null))).toEqual(["no", "a", "b", "c"]);
  });

  it("keeps a column that cannot be hidden in its place and orders the rest", () => {
    expect(ids(arrangeColumns(COLUMNS, ["c", "a", "b"]))).toEqual([
      "no",
      "c",
      "a",
      "b",
    ]);
    const middle = [col("a"), col("fixed", false), col("b")];
    expect(ids(arrangeColumns(middle, ["b", "a"]))).toEqual([
      "b",
      "fixed",
      "a",
    ]);
  });

  it("puts a column the saved order does not know after the known ones", () => {
    expect(ids(arrangeColumns(COLUMNS, ["b", "gone"]))).toEqual([
      "no",
      "b",
      "a",
      "c",
    ]);
  });

  it("moves one column a place, and not past either end", () => {
    const order = movableIds(COLUMNS);
    expect(order).toEqual(["a", "b", "c"]);
    expect(moveColumn(order, "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveColumn(order, "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveColumn(order, "a", -1)).toEqual(order);
    expect(moveColumn(order, "c", 1)).toEqual(order);
    expect(moveColumn(order, "missing", 1)).toEqual(order);
  });
});
