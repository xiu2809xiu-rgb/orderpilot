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
import { useUnsavedChanges } from "./useUnsavedChanges";

interface UnsavedChangesDialogProps<T extends FieldValues, O> {
  form: UseFormReturn<T, unknown, O>;
  /** True when a draft holds the changes, so leaving does not lose them. */
  draftKept: boolean;
}

/** The one prompt before a route change takes unsaved changes away. */
export function UnsavedChangesDialog<T extends FieldValues, O = T>({
  form,
  draftKept,
}: UnsavedChangesDialogProps<T, O>) {
  const { t } = useTranslation("form");
  const blocker = useUnsavedChanges(form);
  return (
    <Dialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("unsaved.title")}</DialogTitle>
          <DialogDescription>
            {t(draftKept ? "unsaved.kept" : "unsaved.lost")}
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
