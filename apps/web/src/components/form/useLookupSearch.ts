import { useCallback, useEffect, useRef, useState } from "react";
import type { LookupOption, LookupSearch } from "./lookup";

export type LookupStatus = "idle" | "loading" | "done" | "failed";

export interface LookupState {
  status: LookupStatus;
  query: string;
  options: readonly LookupOption[];
}

const IDLE: LookupState = { status: "idle", query: "", options: [] };

/**
 * Results belong to the text they answered. While a newer search is pending,
 * the old ones would let a fast typist pick a record that the text no longer
 * names, so they go the moment the text changes.
 */
function optionsFor(before: LookupState, query: string) {
  return before.query === query ? before.options : [];
}

/**
 * Runs a lookup's searches: debounced while the person types, and each one
 * aborted the moment a newer one starts, so a slow answer never overwrites a
 * newer one. Nothing runs after unmount.
 */
export function useLookupSearch(search: LookupSearch, debounceMs: number) {
  const [state, setState] = useState<LookupState>(IDLE);
  const latest = useRef(search);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const running = useRef<AbortController | null>(null);

  useEffect(() => {
    latest.current = search;
  });

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    running.current?.abort();
    running.current = null;
  }, []);

  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    (query: string) => {
      cancel();
      const mine = new AbortController();
      running.current = mine;
      setState((before) => ({
        status: "loading",
        query,
        options: optionsFor(before, query),
      }));
      latest.current(query, mine.signal).then(
        (options) => {
          if (!mine.signal.aborted)
            setState({ status: "done", query, options });
        },
        () => {
          if (!mine.signal.aborted) {
            setState({ status: "failed", query, options: [] });
          }
        },
      );
    },
    [cancel],
  );

  const schedule = useCallback(
    (query: string) => {
      cancel();
      setState((before) => ({
        status: "loading",
        query,
        options: optionsFor(before, query),
      }));
      timer.current = setTimeout(() => {
        run(query);
      }, debounceMs);
    },
    [cancel, run, debounceMs],
  );

  const stop = useCallback(() => {
    cancel();
    setState((before) =>
      before.status === "loading" ? { ...before, status: "idle" } : before,
    );
  }, [cancel]);

  return { state, run, schedule, stop };
}
