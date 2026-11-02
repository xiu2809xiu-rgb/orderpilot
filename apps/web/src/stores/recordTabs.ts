import { useEffect, useMemo } from "react";
import { useLocation } from "react-router";
import { z } from "zod";
import { create } from "zustand";
import type { RecordKind, RecordRef } from "@/lib/records";
import { resolveRecord } from "@/lib/resolveRecord";

/** More than this and the oldest tab with nothing unsaved makes room. */
export const MAX_TABS = 10;

// Typed against RecordKind, so a new kind cannot be forgotten here.
const RECORD_KINDS = [
  "order",
  "orderSteps",
  "spr",
  "document",
  "item",
  "customer",
  "vendor",
] as const satisfies readonly RecordKind[];

/** A path inside this app. Storage can be edited, so a tab may never point anywhere else. */
const appPath = z
  .string()
  .refine((value) => value.startsWith("/") && !value.startsWith("//"));

const tabSchema = z
  .object({
    key: appPath,
    kind: z.enum(RECORD_KINDS),
    no: z.string().min(1),
    listPath: appPath,
    /** The address as it was last seen, with its query, so the tab opens exactly that. */
    to: appPath,
    /** Set by the record's form through `useMarkRecordDirty`. */
    dirty: z.boolean(),
  })
  // The address is the record's own, plus at most a query or a fragment.
  .refine(
    ({ key, to }) =>
      to.startsWith(key) && /^([?#]|$)/.test(to.slice(key.length)),
  );
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
  // A form can report unsaved changes before its tab exists (a typed address, a
  // reload, a link that is not a RecordLink). The mark waits here for the tab.
  const pendingDirty = new Set<string>();

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
      pendingDirty.clear();
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
      const tab: RecordTab = {
        ...record,
        to,
        dirty: pendingDirty.has(record.key),
      };
      pendingDirty.delete(record.key);
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
      pendingDirty.delete(key);
      commit(get().tabs.filter((tab) => tab.key !== key));
    },
    setDirty: (key, dirty) => {
      const { tabs } = get();
      if (!tabs.some((tab) => tab.key === key)) {
        if (dirty) pendingDirty.add(key);
        else pendingDirty.delete(key);
        return;
      }
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
