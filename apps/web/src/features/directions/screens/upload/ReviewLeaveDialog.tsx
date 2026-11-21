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

interface ReviewLeaveDialogProps {
  open: boolean;
  /** Keep reviewing: also what Escape does. */
  onStay: () => void;
  onLeave: () => void;
}

/**
 * The one question this screen asks before a review in progress is lost. The
 * leave guard asks it when the person moves to another page, and Start again
 * asks it too, so both put the same words and the same safe default in front
 * of the person: Keep reviewing takes focus, so Enter never loses work.
 */
export function ReviewLeaveDialog({
  open,
  onStay,
  onLeave,
}: ReviewLeaveDialogProps) {
  const { t } = useTranslation("directions-intake");
  const stay = useRef<HTMLButtonElement>(null);
  const focus = useRestoreFocus(() => stay.current);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onStay();
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
          <Button variant="outline" onClick={onLeave}>
            {t("review.leave.leave")}
          </Button>
          <Button ref={stay} onClick={onStay}>
            {t("review.leave.stay")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
