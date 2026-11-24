import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { disableTwoStep } from "@/lib/api/two-step";
import { useRestoreFocus } from "@/lib/useRestoreFocus";
import { useSessionStore } from "@/stores/session";
import { TwoStepProofForm } from "./TwoStepProofForm";
import { twoStepStatusKey } from "./useTwoStepStatus";

/**
 * Turning two-step off. A session cookie alone cannot do it: it takes a
 * current code or a recovery code, and for a password session the password.
 * The call is made by hand and its answer holds nothing secret.
 */
export function TwoStepDisableDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const focus = useRestoreFocus();
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("account.twoStep.disable.title")}</DialogTitle>
          <DialogDescription>
            {t("account.twoStep.disable.body")}
          </DialogDescription>
        </DialogHeader>
        <TwoStepProofForm
          idPrefix="two-step-disable"
          needsPassword={session?.demo !== true}
          allowRecovery
          send={(proof, password) => disableTwoStep({ ...proof, password })}
          onDone={(status) => {
            queryClient.setQueryData(
              twoStepStatusKey(session?.user.id),
              status,
            );
            toast.done(t("account.twoStep.turnedOff"));
            onClose();
          }}
          onBusy={setBusy}
          submitLabel={t("account.twoStep.disable.submit")}
          cancelLabel={t("account.twoStep.disable.cancel")}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
