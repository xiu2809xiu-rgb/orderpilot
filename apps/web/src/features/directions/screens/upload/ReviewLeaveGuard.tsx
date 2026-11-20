import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useBlocker } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { registerDirtyForm } from "@/lib/dirty-forms";
import { useRestoreFocus } from "@/lib/useRestoreFocus";
import { useSessionStore } from "@/stores/session";

/**
 * Asks before a review in progress is lost: the browser's own question when
 * the tab is reloaded or closed, and the app's dialog (the one the forms use
 * for unsaved work, with this screen's words) when the person moves to another
 * page. It guards from the moment a reading starts until the review is
 * finished; before that and after that nothing is held. Sign out asks too.
 */
export function ReviewLeaveGuard({ active }: { active: boolean }) {
  const { t } = useTranslation("directions-intake");
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
  const stay = useRef<HTMLButtonElement>(null);
  // Keep reviewing is the safe answer, so Enter gives it.
  const focus = useRestoreFocus(() => stay.current);

  return (
    <Dialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{t("review.leave.title")}</DialogTitle>
          <DialogDescription>{t("review.leave.body")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              blocker.proceed?.();
            }}
          >
            {t("review.leave.leave")}
          </Button>
          <Button
            ref={stay}
            onClick={() => {
              blocker.reset?.();
            }}
          >
            {t("review.leave.stay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
