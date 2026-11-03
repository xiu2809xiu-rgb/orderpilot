import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { LookupSearch } from "@/components/form";
import type { ItemSearch } from "./types";

/**
 * The screen's item search, made steady and watched. The screen often writes
 * it inline; the lookup must not restart when the screen re-renders, so this
 * always calls the latest. It also remembers the last answer, so that Enter on
 * a part number the search found nothing for can say so: the lookup itself
 * says nothing until the person leaves the cell.
 */
export function useItemSearch(
  searchItems: ItemSearch,
  name: string,
  advance: { current: number | null },
) {
  const { t } = useTranslation("linesGrid");
  const { setError } = useFormContext();
  const latest = useRef(searchItems);
  useEffect(() => {
    latest.current = searchItems;
  });
  const last = useRef<{ query: string; count: number } | null>(null);

  const flagUnknown = useCallback(
    (row: number, text: string): boolean => {
      const typed = text.trim();
      if (typed === "" || last.current?.query.trim() !== typed) return false;
      if (last.current.count > 0) return false;
      setError(`${name}.${String(row)}.item`, {
        type: "lookup",
        message: t("unknownItem", { text: typed }),
      });
      return true;
    },
    [name, setError, t],
  );

  const search = useMemo<LookupSearch>(
    () => async (query, signal) => {
      const found = await latest.current(query, signal);
      if (!signal.aborted) {
        last.current = { query, count: found.length };
        // Enter came before the answer did: it has nothing to pick.
        if (advance.current !== null && found.length === 0) {
          flagUnknown(advance.current, query);
        }
      }
      return found;
    },
    [advance, flagUnknown],
  );

  return { search, flagUnknown };
}
