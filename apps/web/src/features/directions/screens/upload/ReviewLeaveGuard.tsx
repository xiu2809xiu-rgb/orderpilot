import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router";
import { registerDirtyForm } from "@/lib/dirty-forms";
import { useSessionStore } from "@/stores/session";
import { ReviewLeaveDialog } from "./ReviewLeaveDialog";

/**
 * Asks before a review in progress is lost: the browser's own question when
 * the tab is reloaded or closed, and the app's dialog (the one the forms use
 * for unsaved work, with this screen's words) when the person moves to another
 * page. It guards from the moment a reading starts until the review is
 * finished; before that and after that nothing is held. Sign out asks too.
 */
export function ReviewLeaveGuard({ active }: { active: boolean }) {
  // A ref, so the blocker and the listeners always see the latest answer.
  const held = useRef(active);
  useEffect(() => {
    held.current = active;
  }, [active]);
  const viewerId = useRef(useSessionStore.getState().session?.user.id);

  useEffect(
    () =>
      registerDirtyForm(
        () =>
          held.current &&
          useSessionStore.getState().session?.user.id === viewerId.current,
      ),
    [],
  );
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (held.current) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) =>
        held.current &&
        // Whoever just signed in has no review here.
        useSessionStore.getState().session?.user.id === viewerId.current &&
        currentLocation.pathname !== nextLocation.pathname,
      [],
    ),
  );
  return (
    <ReviewLeaveDialog
      open={blocker.state === "blocked"}
      onStay={() => {
        blocker.reset?.();
      }}
      onLeave={() => {
        blocker.proceed?.();
      }}
    />
  );
}
