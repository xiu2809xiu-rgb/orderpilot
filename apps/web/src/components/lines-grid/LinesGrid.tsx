import { Plus } from "lucide-react";
import { useId, useMemo, useRef, type CSSProperties } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { lookupText, lookupValueSchema } from "@/components/form";
import { Button } from "@/components/ui/button";
import { GridContext, type GridContextValue } from "./gridContext";
import { LineRow } from "./LineRow";
import { LinesFooter } from "./LinesFooter";
import { editableKinds, trackTemplate } from "./lineValues";
import type { ColumnKind, LineColumn, LinesGridProps } from "./types";
import { useGridKeys } from "./useGridKeys";
import { useItemPick } from "./useItemPick";
import { useItemSearch } from "./useItemSearch";
import { useLineActions } from "./useLineActions";
import { useLineTotals } from "./useLineTotals";
import { usePendingFocus } from "./usePendingFocus";
import { useStable } from "./useStable";

// Whole class names for Tailwind. Numbers line up on the right, as their cells do.
function headerClass(kind: ColumnKind): string | undefined {
  if (kind === "remove") return "sr-only";
  const numeric =
    kind === "quantity" || kind === "unitPrice" || kind === "amount";
  return numeric ? "@lines:text-right" : undefined;
}

/** Where Enter on an item goes: the quantity, since the pick filled the description. */
function afterItem(editable: readonly string[]): string | undefined {
  return editable.find((kind) => kind !== "item" && kind !== "description");
}

/**
 * A table of order or SPR lines that is typed into, not clicked through. Put it
 * inside a `FormShell` whose form has a `lines` array of `LineValue`. Columns
 * come from the screen, the item search too; the grid does the rest: keys,
 * lookup, amounts, stock, errors, masks and a read-only view of a saved record.
 */
export function LinesGrid(props: LinesGridProps) {
  const { t } = useTranslation("linesGrid");
  const { control, getValues } = useFormContext();
  const name = props.name ?? "lines";
  const readOnly = props.readOnly === true;
  const priceMask = useStable(props.priceMask ?? null);
  const declared = useStable(props.columns);
  const columns = useMemo<readonly LineColumn[]>(
    () => declared.filter((c) => !(readOnly && c.kind === "remove")),
    [declared, readOnly],
  );
  const hintId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const array = useFieldArray({ control, name });
  const editable = useMemo(
    () => editableKinds(columns, { priceMasked: priceMask !== null }),
    [columns, priceMask],
  );
  const ask = usePendingFocus(rootRef);
  const { add, remove } = useLineActions({
    name,
    array,
    newLine: props.newLine,
    firstEditable: editable[0],
    ask,
  });
  const advance = useRef<number | null>(null);
  const itemSearch = useItemSearch(props.searchItems, name, advance);
  const keys = useGridKeys({
    rootRef,
    advance,
    flagUnknown: itemSearch.flagUnknown,
    editable,
    rowCount: array.fields.length,
    add,
    remove,
    readOnly,
    isSettled: (row, input) => {
      const parsed = lookupValueSchema.safeParse(
        getValues(`${name}.${String(row)}.item`),
      );
      return parsed.success && lookupText(parsed.data) === input.value;
    },
  });
  const itemPrice = props.itemPrice ?? "fill";
  const pick = useItemPick({
    name,
    priceMask,
    itemPrice,
    advance,
    advanceTo: afterItem(editable),
    root: rootRef,
  });
  const context = useMemo<GridContextValue>(
    () => ({
      name,
      columns,
      searchItems: itemSearch.search,
      debounceMs: props.debounceMs ?? 250,
      readOnly,
      priceMask,
      itemPrice,
      shortfallAction: props.shortfallAction,
      pick,
      remove,
    }),
    [
      name,
      columns,
      props.debounceMs,
      readOnly,
      priceMask,
      itemPrice,
      props.shortfallAction,
      pick,
      remove,
    ],
  );
  const totals = useLineTotals({
    name,
    hasAmount: columns.some((c) => c.kind === "amount"),
    priceMask,
    serverTotals: props.serverTotals,
  });

  return (
    <GridContext value={context}>
      <div className="@container space-y-s2">
        <div
          ref={rootRef}
          role="presentation"
          onKeyDown={keys.onKeyDown}
          onKeyDownCapture={keys.onKeyDownCapture}
        >
          <div
            role="table"
            aria-label={props.label}
            aria-describedby={readOnly ? undefined : hintId}
            style={
              {
                "--line-tracks": trackTemplate(columns),
                "--line-tracks-compact": trackTemplate(columns, true),
              } as CSSProperties
            }
          >
            <div
              role="row"
              className="px-0 text-xs font-medium text-muted-foreground @max-lines:sr-only @lines:grid @lines:grid-cols-(--line-tracks-compact) @3xl:grid-cols-(--line-tracks) @lines:gap-x-s1 @lines:border-b @lines:pb-1"
            >
              {columns.map((column) => (
                <div
                  key={column.kind}
                  role="columnheader"
                  className={headerClass(column.kind)}
                >
                  {column.header}
                </div>
              ))}
            </div>
            <div role="rowgroup" className="space-y-s2 @lines:space-y-0">
              {array.fields.map((field, index) => (
                <LineRow key={field.id} index={index} />
              ))}
            </div>
          </div>
        </div>
        {array.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {readOnly ? t("emptyReadOnly") : t("empty")}
          </p>
        ) : null}
        {readOnly ? null : (
          <div className="flex flex-wrap items-center justify-between gap-s2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-add-line
              className="pointer-coarse:h-11 @max-lines:h-11"
              onClick={add}
            >
              <Plus aria-hidden="true" />
              {t("add")}
            </Button>
            <p
              id={hintId}
              className="hidden max-w-[70ch] text-xs text-muted-foreground @lines:block"
            >
              {t("keys")}
            </p>
          </div>
        )}
        {props.footer ? props.footer(totals) : <LinesFooter totals={totals} />}
      </div>
    </GridContext>
  );
}
