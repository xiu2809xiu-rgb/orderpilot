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
  const { t } = useTranslation();
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
          <DialogTitle>{t("userMenu.signOutTitle")}</DialogTitle>
          <DialogDescription>
            {t("userMenu.signOutDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onSignOut}>
            {t("userMenu.signOut")}
          </Button>
          <Button ref={keep} onClick={onKeep}>
            {t("userMenu.signOutKeep")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
