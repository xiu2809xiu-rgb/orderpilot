import { useSyncExternalStore } from "react";

/**
 * A module that stays out of the entry chunk and is fetched once, when a
 * component first needs it. Components read it with `useDeferredModule`.
 */
export interface DeferredModule<M> {
  /** Fetches the module, once. A failed fetch is tried again next time. */
  load: () => Promise<M>;
  /** The module if it has arrived, else undefined. */
  current: () => M | undefined;
  subscribe: (listener: () => void) => () => void;
}

export function deferredModule<M>(
  importer: () => Promise<M>,
): DeferredModule<M> {
  let loaded: M | undefined;
  let pending: Promise<M> | undefined;
  const listeners = new Set<() => void>();

  return {
    load: () => {
      pending ??= importer().then(
        (module) => {
          loaded = module;
          for (const listener of listeners) listener();
          return module;
        },
        (error: unknown) => {
          pending = undefined;
          throw error;
        },
      );
      return pending;
    },
    current: () => loaded,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The module once it has arrived; the caller re-renders when it does. */
export function useDeferredModule<M>(module: DeferredModule<M>): M | undefined {
  return useSyncExternalStore(module.subscribe, module.current);
}

/**
 * Starts the fetch without waiting for it. A prefetch that fails is quiet:
 * the click that needs the module fetches it again.
 */
export function prefetch(module: DeferredModule<unknown>): void {
  module.load().catch(() => undefined);
}

/**
 * Runs a task once the browser is idle after the first paint, so prefetching
 * never competes with it. Safari has no requestIdleCallback, hence the timer.
 * Returns a cancel function, for an effect's clean-up.
 */
export function whenIdle(task: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(task, { timeout: 2_000 });
    return () => {
      window.cancelIdleCallback(id);
    };
  }
  const id = setTimeout(task, 200);
  return () => {
    clearTimeout(id);
  };
}
