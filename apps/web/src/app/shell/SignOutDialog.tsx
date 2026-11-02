import { useRef } from "react";
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
import { useRestoreFocus } from "@/lib/useRestoreFocus";

interface SignOutDialogProps {
  open: boolean;
  onKeep: () => void;
  onSignOut: () => void;
}

/**
 * Signing out deletes the drafts on this device, so a person with unsaved
 * changes is asked first. Keeping the changes is the answer Enter gives.
 */
export function SignOutDialog({ open, onKeep, onSignOut }: SignOutDialogProps) {
  const { t } = useTranslation("form");
  const keep = useRef<HTMLButtonElement>(null);
  const focus = useRestoreFocus(() => keep.current);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onKeep();
      }}
    >
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{t("signOut.title")}</DialogTitle>
          <DialogDescription>{t("signOut.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onSignOut}>
            {t("signOut.confirm")}
          </Button>
          <Button ref={keep} onClick={onKeep}>
            {t("signOut.keep")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
