import { useCallback, useState } from "react";
import { z } from "zod";
import { useSessionStore } from "@/stores/session";
import type { SavedView, TableQuery } from "./types";

const filtersSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));
const idsSchema = z.array(z.string()).nullable();
// `order` and a view's columns came with P-45. A copy saved before them still
// parses: it simply has no order, and its views leave the columns alone.
const prefsSchema = z.object({
  hidden: idsSchema,
  order: idsSchema.default(null),
  saved: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      search: z.string(),
      filters: filtersSchema,
      sort: z
        .object({
          columnId: z.string(),
          direction: z.enum(["asc", "desc"]),
        })
        .nullable(),
      hidden: idsSchema.optional(),
      order: idsSchema.optional(),
    }),
  ),
});
type Prefs = z.infer<typeof prefsSchema>;

const EMPTY: Prefs = { hidden: null, order: null, saved: [] };

function read(key: string): Prefs {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return EMPTY;
    const parsed = prefsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    // Private windows and blocked storage throw. The table works without it.
    return EMPTY;
  }
}

function write(key: string, prefs: Prefs) {
  try {
    localStorage.setItem(key, JSON.stringify(prefs));
  } catch {
    // Not saved this time. Nothing else depends on it.
  }
}

/**
 * Column choices and saved views for one table and one signed-in viewer, kept
 * in this browser. Another person on the same device has their own. `hidden`
 * and `order` are null until the viewer changes them, so the columns' own
 * `defaultHidden` and declared order apply first.
 */
export function useTablePrefs(tableId: string) {
  const viewerId = useSessionStore((state) => state.session?.user.id);
  const key = `op.table.${tableId}.${viewerId ?? "anonymous"}`;
  // The state remembers which key it was read for. When the key moves (the
  // session hydrates, or another person signs in), the stored copy is for
  // someone else, so this render reads the new key instead. Nothing is written
  // under the new key until the viewer changes something.
  const [state, setState] = useState(() => ({ key, prefs: read(key) }));
  const prefs = state.key === key ? state.prefs : read(key);

  const update = useCallback(
    (change: (current: Prefs) => Prefs) => {
      setState((previous) => {
        const current = previous.key === key ? previous.prefs : read(key);
        const next = change(current);
        write(key, next);
        return { key, prefs: next };
      });
    },
    [key],
  );

  return {
    hidden: prefs.hidden,
    order: prefs.order,
    saved: prefs.saved as SavedView[],
    setHidden: (hidden: string[] | null) => {
      update((current) => ({ ...current, hidden }));
    },
    setOrder: (order: string[] | null) => {
      update((current) => ({ ...current, order }));
    },
    /** Back to the columns as the screen declares them. */
    resetColumns: () => {
      update((current) => ({ ...current, hidden: null, order: null }));
    },
    /** Saves the search, filters and sort with the columns as they are now. */
    saveView: (name: string, query: TableQuery) => {
      update((current) => {
        const view: SavedView = {
          id: crypto.randomUUID(),
          name,
          search: query.search,
          filters: query.filters,
          sort: query.sort,
          hidden: current.hidden,
          order: current.order,
        };
        return { ...current, saved: [...current.saved, view] };
      });
    },
    /** Takes a view's columns. A view saved without them leaves the columns as they are. */
    applyColumns: (view: SavedView) => {
      if (view.hidden === undefined && view.order === undefined) return;
      update((current) => ({
        ...current,
        hidden: view.hidden ?? null,
        order: view.order ?? null,
      }));
    },
    deleteView: (id: string) => {
      update((current) => ({
        ...current,
        saved: current.saved.filter((view) => view.id !== id),
      }));
    },
  };
}

export type TablePrefs = ReturnType<typeof useTablePrefs>;
