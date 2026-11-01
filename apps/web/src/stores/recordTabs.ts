import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { z } from "zod";
import { create } from "zustand";
import { RECORD_KINDS, resolveRecord, type RecordRef } from "@/lib/records";

/** More than this and the oldest tab with nothing unsaved makes room. */
export const MAX_TABS = 10;

const tabSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(RECORD_KINDS),
  no: z.string().min(1),
  listPath: z.string().min(1),
  /** The address as it was last seen, with its query, so the tab opens exactly that. */
  to: z.string().min(1),
  /** Set by the record's form through `useMarkRecordDirty`. */
  dirty: z.boolean(),
});
const storedSchema = z.array(tabSchema).max(MAX_TABS);

export type RecordTab = z.infer<typeof tabSchema>;

export type OpenResult =
  | { outcome: "added" | "existing"; tab: RecordTab }
  | { outcome: "replaced"; tab: RecordTab; closed: RecordTab }
  | { outcome: "full" };

export function storageKey(viewerId: string): string {
  return `op.tabs.${viewerId}`;
}

function read(key: string): RecordTab[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    // Blocked storage or a broken copy: start with no tabs. Nothing else depends on them.
    return [];
  }
}

function write(key: string | null, tabs: RecordTab[]) {
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(tabs));
  } catch {
    // Not kept this time. The tabs still work until the page reloads.
  }
}

/** Whether opening a record has something to say. A plain open that just worked is silent. */
export function hasNews(result: OpenResult, background: boolean): boolean {
  return (
    background || result.outcome === "full" || result.outcome === "replaced"
  );
}

interface RecordTabsState {
  /** The storage key of the person whose tabs these are, or null before sign-in. */
  owner: string | null;
  tabs: RecordTab[];
  /** Shows this viewer's tabs. Another viewer's, or another role's, never show. */
  load: (viewerId: string | null) => void;
  /**
   * Adds the record's tab, or finds it when it is already open. At the limit
   * the oldest tab with nothing unsaved closes, never the one named `keep`
   * (the page on screen). When every other tab has unsaved changes nothing opens.
   */
  open: (record: RecordRef, to: string, keep?: string) => OpenResult;
  close: (key: string) => void;
  setDirty: (key: string, dirty: boolean) => void;
}

export const useRecordTabs = create<RecordTabsState>()((set, get) => {
  function commit(tabs: RecordTab[]) {
    set({ tabs });
    write(get().owner, tabs);
  }

  return {
    owner: null,
    tabs: [],
    load: (viewerId) => {
      const owner = viewerId ? storageKey(viewerId) : null;
      if (owner === get().owner) return;
      set({ owner, tabs: owner ? read(owner) : [] });
    },
    open: (record, to, keep) => {
      const { tabs } = get();
      const found = tabs.find((tab) => tab.key === record.key);
      if (found) {
        if (found.to === to) return { outcome: "existing", tab: found };
        const moved = { ...found, to };
        commit(tabs.map((tab) => (tab === found ? moved : tab)));
        return { outcome: "existing", tab: moved };
      }
      const tab: RecordTab = { ...record, to, dirty: false };
      if (tabs.length < MAX_TABS) {
        commit([...tabs, tab]);
        return { outcome: "added", tab };
      }
      const closed = tabs.find((each) => !each.dirty && each.key !== keep);
      if (!closed) return { outcome: "full" };
      commit([...tabs.filter((each) => each !== closed), tab]);
      return { outcome: "replaced", tab, closed };
    },
    close: (key) => {
      commit(get().tabs.filter((tab) => tab.key !== key));
    },
    setDirty: (key, dirty) => {
      const { tabs } = get();
      if (!tabs.some((tab) => tab.key === key && tab.dirty !== dirty)) return;
      commit(tabs.map((tab) => (tab.key === key ? { ...tab, dirty } : tab)));
    },
  };
});

/**
 * The one registration a form makes: `useMarkRecordDirty(form.formState.isDirty)`.
 * It marks the tab of the record on screen. The mark stays when the form
 * unmounts, because the draft store keeps the draft; pass false once the form
 * is saved or its draft thrown away. A page that is not a record does nothing.
 */
export function useMarkRecordDirty(dirty: boolean): void {
  const { pathname } = useLocation();
  const key = useMemo(() => resolveRecord(pathname)?.key, [pathname]);
  useEffect(() => {
    if (key) useRecordTabs.getState().setDirty(key, dirty);
  }, [key, dirty]);
}
