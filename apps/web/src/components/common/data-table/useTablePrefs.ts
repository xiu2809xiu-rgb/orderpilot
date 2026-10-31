import { useCallback, useState } from "react";
import { z } from "zod";
import { useSessionStore } from "@/stores/session";
import type { SavedFilter, TableQuery } from "./types";

const filtersSchema = z.record(z.string(), z.union([z.string(), z.boolean()]));
const prefsSchema = z.object({
  hidden: z.array(z.string()).nullable(),
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
    }),
  ),
});
type Prefs = z.infer<typeof prefsSchema>;

const EMPTY: Prefs = { hidden: null, saved: [] };

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
 * Column choices and saved filters for one table and one signed-in viewer,
 * kept in this browser. Another person on the same device has their own.
 * `hidden` is null until the viewer changes it, so the columns' own
 * `defaultHidden` applies first.
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
    saved: prefs.saved as SavedFilter[],
    setHidden: (hidden: string[] | null) => {
      update((current) => ({ ...current, hidden }));
    },
    saveFilter: (name: string, query: TableQuery) => {
      const filter: SavedFilter = {
        id: crypto.randomUUID(),
        name,
        search: query.search,
        filters: query.filters,
        sort: query.sort,
      };
      update((current) => ({ ...current, saved: [...current.saved, filter] }));
    },
    deleteFilter: (id: string) => {
      update((current) => ({
        ...current,
        saved: current.saved.filter((filter) => filter.id !== id),
      }));
    },
  };
}
