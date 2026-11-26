import type { MyPicture } from "@orderpilot/shared";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertTitle } from "@/components/kit/Alert";
import { toast } from "@/components/common/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { profilePicturesWithdraw } from "@/lib/api/generated/endpoints/profile-pictures/profile-pictures";
import { describeError } from "@/lib/errors";
import { useRestoreFocus } from "@/lib/useRestoreFocus";

interface RemovePictureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The picture to take back: the one waiting for review, or the approved one. */
  pictureId: string;
  /** Which of the two it is, so the words say what happens to the initials. */
  waiting: boolean;
  /** The answer, to put in place of what the card knew. */
  onRemoved: (answer: MyPicture) => void;
  /** Where focus goes when the dialog closes: the picture may be gone with its button. */
  returnFocus: () => HTMLElement | null;
}

/**
 * Taking a picture back. Nothing is shown in its place but the initials (or
 * the approved picture, when the one removed was waiting), and the stored
 * file is deleted. Keeping it is the answer Enter gives.
 */
export function RemovePictureDialog({
  open,
  onOpenChange,
  pictureId,
  waiting,
  onRemoved,
  returnFocus,
}: RemovePictureDialogProps) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const keep = useRef<HTMLButtonElement>(null);
  const focus = useRestoreFocus(() => keep.current);
  const withdraw = useMutation({
    mutationFn: () => profilePicturesWithdraw(pictureId),
    onSuccess: (answer) => {
      onRemoved(answer.data);
      toast.done(t("account.picture.removed"));
      onOpenChange(false);
    },
  });
  const failure = withdraw.isError ? describeError(withdraw.error, tc) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) withdraw.reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus()?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("account.picture.removeTitle")}</DialogTitle>
          <DialogDescription>
            {waiting
              ? t("account.picture.removeBodyWaiting")
              : t("account.picture.removeBody")}
          </DialogDescription>
        </DialogHeader>
        {failure ? (
          <Alert variant="destructive">
            <AlertTitle>{failure.message}</AlertTitle>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={withdraw.isPending}
            onClick={() => {
              withdraw.mutate();
            }}
          >
            {t("account.picture.removeConfirm")}
          </Button>
          <Button
            ref={keep}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t("account.picture.removeKeep")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
