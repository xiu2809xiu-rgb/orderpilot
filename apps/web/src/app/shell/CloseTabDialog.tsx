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

interface CloseTabDialogProps {
  /** The record's name, such as "Order SO-26-0001", or null when closed. */
  name: string | null;
  onKeep: () => void;
  onClose: () => void;
}

/**
 * Asks before a tab with unsaved changes closes. The form kit (P-46) brings
 * the shared "leave with unsaved changes" dialog; this one says the same and
 * gives way to it once P-47 registers forms with `useMarkRecordDirty`.
 */
export function CloseTabDialog({ name, onKeep, onClose }: CloseTabDialogProps) {
  const { t } = useTranslation("record-tabs");
  return (
    <Dialog
      open={name !== null}
      onOpenChange={(open) => {
        if (!open) onKeep();
      }}
    >
      <DialogContent
        showCloseButton={false}
        // The strip puts the focus back itself: on the tab, or where it closed.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("confirm.title", { name })}</DialogTitle>
          <DialogDescription>{t("confirm.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onKeep}>
            {t("confirm.keep")}
          </Button>
          <Button onClick={onClose}>{t("confirm.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
