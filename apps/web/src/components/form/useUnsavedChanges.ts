import { useCallback, useEffect, useRef } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useBlocker, type Blocker } from "react-router";
import { useSessionStore } from "@/stores/session";

/**
 * Holds a route change while the form has unsaved changes, and asks the browser
 * to ask before the tab closes. A change of query string alone stays on the
 * page, so it passes.
 */
export function useUnsavedChanges<T extends FieldValues, O = T>(
  form: UseFormReturn<T, unknown, O>,
): Blocker {
  // A ref, fed as the form changes rather than at render: a save resets the form
  // and navigates in one tick, before React could pass a new value down.
  const dirty = useRef(false);
  const viewerId = useRef(useSessionStore.getState().session?.user.id);

  useEffect(
    () =>
      form.subscribe({
        formState: { isDirty: true },
        callback: ({ isDirty }) => {
          dirty.current = isDirty ?? false;
        },
      }),
    [form],
  );

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (dirty.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  return useBlocker(
    useCallback(({ currentLocation, nextLocation }) => {
      // Whoever just signed in has no unsaved changes here.
      const sameViewer =
        useSessionStore.getState().session?.user.id === viewerId.current;
      return (
        dirty.current &&
        sameViewer &&
        currentLocation.pathname !== nextLocation.pathname
      );
    }, []),
  );
}
