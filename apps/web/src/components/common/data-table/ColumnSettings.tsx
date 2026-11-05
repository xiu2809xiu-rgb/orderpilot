import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { moveColumn } from "./columnOrder";
import type { DataTableColumn } from "./types";

interface ColumnSettingsProps<Row> {
  /** Every column, in the order the viewer has them. */
  columns: readonly DataTableColumn<Row>[];
  visible: ReadonlySet<string>;
  onVisibleChange: (visibleIds: string[]) => void;
  /** The ids of the columns that can move, in their new order. */
  onOrderChange: (ids: string[]) => void;
  onReset: () => void;
}

/**
 * Column settings: tick the columns to show, and move them up or down to
 * order them. The record number cannot be hidden or moved, so it is not
 * listed. Buttons, not dragging, so a keyboard and a screen reader can do it
 * too; the moved button keeps the focus. Kept per viewer.
 */
export function ColumnSettings<Row>({
  columns,
  visible,
  onVisibleChange,
  onOrderChange,
  onReset,
}: ColumnSettingsProps<Row>) {
  const { t } = useTranslation("components");
  const listId = useId();
  const [moved, setMoved] = useState<string | null>(null);
  const movable = columns.filter((column) => column.hideable !== false);
  const ids = movable.map((column) => column.id);

  useEffect(() => {
    // The list is drawn in its new order before this runs.
    if (moved) document.getElementById(moved)?.focus();
  }, [moved, columns]);

  if (movable.length === 0) return null;

  function toggle(id: string, show: boolean) {
    const next = new Set(visible);
    if (show) next.add(id);
    else next.delete(id);
    onVisibleChange(columns.filter((c) => next.has(c.id)).map((c) => c.id));
  }

  function move(id: string, by: -1 | 1, buttonId: string) {
    onOrderChange(moveColumn(ids, id, by));
    setMoved(buttonId);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="pointer-coarse:h-11">
          <Columns3 aria-hidden="true" />
          {t("table.columns")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={16}
        className="w-[min(20rem,calc(100vw-2rem))] space-y-s2"
      >
        <p id={`${listId}-title`} className="text-sm font-medium">
          {t("table.columnsTitle")}
        </p>
        <ul
          aria-labelledby={`${listId}-title`}
          className="max-h-[min(24rem,calc(100dvh-14rem))] space-y-1 overflow-y-auto"
        >
          {movable.map((column, index) => {
            const boxId = `${listId}-${column.id}`;
            return (
              <li
                key={column.id}
                className="flex items-center gap-2 pointer-coarse:min-h-11"
              >
                <Checkbox
                  id={boxId}
                  checked={visible.has(column.id)}
                  onCheckedChange={(checked) => {
                    toggle(column.id, checked === true);
                  }}
                />
                <label
                  htmlFor={boxId}
                  className="min-w-0 flex-1 truncate text-sm"
                >
                  {column.header}
                </label>
                {(
                  [
                    [-1, ArrowUp, "table.columnUp", index === 0],
                    [
                      1,
                      ArrowDown,
                      "table.columnDown",
                      index === ids.length - 1,
                    ],
                  ] as const
                ).map(([by, Icon, words, edge]) => {
                  const buttonId = `${boxId}-${String(by)}`;
                  return (
                    <Button
                      key={by}
                      id={buttonId}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="aria-disabled:opacity-40 pointer-coarse:size-11"
                      aria-label={t(words, { column: column.header })}
                      aria-disabled={edge || undefined}
                      onClick={() => {
                        if (!edge) move(column.id, by, buttonId);
                      }}
                    >
                      <Icon aria-hidden="true" />
                    </Button>
                  );
                })}
              </li>
            );
          })}
        </ul>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="pointer-coarse:h-11"
          onClick={onReset}
        >
          {t("table.columnsReset")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
