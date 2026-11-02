import { useRef } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DraftControl } from "./useDraft";
import { useRestoreFocus } from "@/lib/useRestoreFocus";
import { useUnsavedChanges } from "./useUnsavedChanges";

interface UnsavedChangesDialogProps<T extends FieldValues, O> {
  form: UseFormReturn<T, unknown, O>;
  /** The form's draft: when it can hold every change, leaving loses nothing. */
  draft: DraftControl | undefined;
}

/** The one prompt before a route change takes unsaved changes away. */
export function UnsavedChangesDialog<T extends FieldValues, O = T>({
  form,
  draft,
}: UnsavedChangesDialogProps<T, O>) {
  const { t } = useTranslation("form");
  const blocker = useUnsavedChanges(form);
  const stay = useRef<HTMLButtonElement>(null);
  // Keep editing is the safe answer, so it is the one Enter gives; focus goes
  // back to the field the person was in.
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
          <DialogTitle>{t("unsaved.title")}</DialogTitle>
          <DialogDescription>
            {t(
              blocker.state === "blocked" && draft?.keeps() === true
                ? "unsaved.kept"
                : "unsaved.lost",
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              blocker.proceed?.();
            }}
          >
            {t("unsaved.leave")}
          </Button>
          <Button
            ref={stay}
            onClick={() => {
              blocker.reset?.();
            }}
          >
            {t("unsaved.stay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
