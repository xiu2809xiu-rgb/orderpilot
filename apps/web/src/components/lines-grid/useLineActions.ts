import { useCallback, useEffect, useRef } from "react";
import { useFormContext, type UseFieldArrayReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common";
import { lookupText, type LookupValue } from "@/components/form";
import { emptyLine } from "./lineValues";
import type { ColumnKind, LineValue } from "./types";

interface ActionOptions {
  name: string;
  array: UseFieldArrayReturn;
  newLine: (() => LineValue) | undefined;
  firstEditable: ColumnKind | undefined;
  ask: (row: number, cell: string | null) => void;
}

function chosenItem(row: unknown): string {
  if (typeof row !== "object" || row === null || !("item" in row)) return "";
  const item = row.item as LookupValue | null;
  return item ? lookupText(item) : "";
}

/**
 * Adding and removing lines. Both say where the focus goes next, and removing
 * ends with a toast whose Undo puts the same line back where it was.
 */
export function useLineActions({
  name,
  array,
  newLine,
  firstEditable,
  ask,
}: ActionOptions) {
  const { t } = useTranslation("linesGrid");
  const { getValues } = useFormContext();
  const latest = useRef({ array, newLine, firstEditable, ask, name });
  useEffect(() => {
    latest.current = { array, newLine, firstEditable, ask, name };
  });

  const add = useCallback(() => {
    const { array, newLine, firstEditable, ask, name } = latest.current;
    const count = (getValues(name) as unknown[] | undefined)?.length ?? 0;
    ask(count, firstEditable ?? null);
    array.append((newLine ?? emptyLine)(), { shouldFocus: false });
  }, [getValues]);

  const remove = useCallback(
    (index: number, from: ColumnKind | null) => {
      const { array, ask, name } = latest.current;
      const rows = (getValues(name) as unknown[] | undefined) ?? [];
      const removed: unknown = structuredClone(rows[index]);
      if (removed === undefined) return;
      // The next line takes this one's place; at the end, the one before it.
      ask(Math.min(index, rows.length - 2), from);
      array.remove(index);
      let restored = false;
      toast.done(t("removed", { n: index + 1 }), {
        description: chosenItem(removed) || undefined,
        undo: () => {
          if (restored) return;
          restored = true;
          const now = latest.current;
          const length =
            (getValues(now.name) as unknown[] | undefined)?.length ?? 0;
          const at = Math.min(index, length);
          now.ask(at, now.firstEditable ?? null);
          now.array.insert(at, removed, { shouldFocus: false });
        },
      });
    },
    [getValues, t],
  );

  return { add, remove };
}
