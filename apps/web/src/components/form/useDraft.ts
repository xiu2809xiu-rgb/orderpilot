import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import {
  draftKey,
  readDraft,
  removeDraft,
  removeStaleDrafts,
  writeDraft,
} from "@/lib/draft-store";
import { useSessionStore } from "@/stores/session";
import { fitsShape, mergeDraft, omitPaths } from "./draftValues";

export interface DraftOptions {
  /**
   * Fields never written, such as masked ones. The API never sends a masked
   * value, so one in a form is there by accident and must not land in storage.
   * Dotted paths, with `*` for every row: "lines.*.unitPrice".
   */
  exclude?: readonly string[];
  /** Raise it when the form's fields change, so older drafts are dropped. */
  version?: number;
  debounceMs?: number;
}

export interface DraftControl {
  /** When the restored draft was last written. Null when nothing was restored. */
  restoredAt: string | null;
  /** Drops the draft and puts the form back to its defaults. */
  discard: () => void;
  /** Drops the draft and leaves the form alone: call it after a save. */
  clear: () => void;
}

const NOTHING_LEFT_OUT: readonly string[] = [];

/**
 * Keeps a form's unsaved changes in this browser, for one viewer and one record,
 * so they outlive an expired session, a reload or a crash.
 *
 * Mount the form once its record has loaded: a later `form.reset(record)` would
 * replace what was restored.
 */
export function useDraft<T extends FieldValues, O = T>(
  key: string,
  form: UseFormReturn<T, unknown, O>,
  {
    exclude = NOTHING_LEFT_OUT,
    version = 1,
    debounceMs = 400,
  }: DraftOptions = {},
): DraftControl {
  const viewerId = useSessionStore((state) => state.session?.user.id);
  const storageKey = viewerId === undefined ? null : draftKey(viewerId, key);
  const [restoredAt, setRestoredAt] = useState<string | null>(null);
  const seenKey = useRef(storageKey);
  const excluded = useRef(exclude);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingWrite = useRef<(() => void) | null>(null);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    pendingWrite.current = null;
  }, []);

  const flush = useCallback(() => {
    const write = pendingWrite.current;
    cancel();
    write?.();
  }, [cancel]);

  // One effect on purpose. On a new key the old subscription must stop before
  // the form is reset, or the reset would be written under the old key.
  useLayoutEffect(() => {
    excluded.current = exclude;
    if (seenKey.current !== storageKey) {
      // Another person or another record: what is on screen is not theirs.
      seenKey.current = storageKey;
      form.reset();
      setRestoredAt(null);
    }
    if (storageKey === null || viewerId === undefined) return;

    removeStaleDrafts(viewerId);
    const stored = readDraft(storageKey, version);
    const defaults: unknown = form.formState.defaultValues ?? {};
    if (stored && fitsShape(defaults, stored.values)) {
      // The shape was checked just above; a value in it is still the person's
      // own unfinished typing, which the schema checks at save.
      form.reset(mergeDraft(defaults, stored.values) as T, {
        keepDefaultValues: true,
      });
      setRestoredAt(stored.savedAt);
    } else if (stored) {
      removeDraft(storageKey);
    }

    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: ({ values, defaultValues }) => {
        const kept = omitPaths(values, excluded.current);
        const base = omitPaths(defaultValues ?? {}, excluded.current);
        if (JSON.stringify(kept) === JSON.stringify(base)) {
          cancel();
          removeDraft(storageKey);
          setRestoredAt(null);
          return;
        }
        pendingWrite.current = () => {
          // Signed out while a write waited: that draft is gone for good.
          if (useSessionStore.getState().session === null) return;
          writeDraft(storageKey, {
            version,
            savedAt: new Date().toISOString(),
            values: kept as Record<string, unknown>,
          });
        };
        clearTimeout(timer.current);
        timer.current = setTimeout(flush, debounceMs);
      },
    });
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      unsubscribe();
      flush();
    };
  }, [storageKey, viewerId, form, version, debounceMs, exclude, cancel, flush]);

  const clear = useCallback(() => {
    cancel();
    if (storageKey !== null) removeDraft(storageKey);
    setRestoredAt(null);
  }, [cancel, storageKey]);

  const discard = useCallback(() => {
    clear();
    form.reset();
  }, [clear, form]);

  return useMemo(
    () => ({ restoredAt, discard, clear }),
    [restoredAt, discard, clear],
  );
}
