import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { makeNewRecoveryCodes } from "@/lib/api/two-step";
import { useRestoreFocus } from "@/lib/useRestoreFocus";
import { useSessionStore } from "@/stores/session";
import { RecoveryCodesView } from "./RecoveryCodesView";
import { TwoStepProofForm } from "./TwoStepProofForm";
import { twoStepStatusKey } from "./useTwoStepStatus";

/**
 * New recovery codes: a current code first, then the ten codes shown once.
 * The old ones stop working at once on the server. Like the setup dialog it
 * holds the codes in its own state only, and cannot be closed until they are
 * saved.
 */
export function TwoStepNewCodesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const userId = useSessionStore((state) => state.session?.user.id);
  const focus = useRestoreFocus();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = codes !== null || busy;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !locked) onClose();
      }}
    >
      <DialogContent
        showCloseButton={codes === null}
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (locked) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (locked) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {codes === null
              ? t("account.twoStep.regenerate.title")
              : t("account.twoStep.recoveryView.title")}
          </DialogTitle>
          <DialogDescription>
            {codes === null
              ? t("account.twoStep.regenerate.body")
              : t("account.twoStep.recoveryView.body")}
          </DialogDescription>
        </DialogHeader>
        {codes === null ? (
          <TwoStepProofForm
            idPrefix="two-step-codes"
            send={(proof) =>
              "code" in proof
                ? makeNewRecoveryCodes(proof.code)
                : Promise.reject(new Error("A current code is needed."))
            }
            onDone={(answer) => {
              queryClient.setQueryData(twoStepStatusKey(userId), answer.status);
              setCodes(answer.recoveryCodes);
            }}
            onBusy={setBusy}
            submitLabel={t("account.twoStep.regenerate.submit")}
            cancelLabel={t("account.twoStep.regenerate.cancel")}
            onCancel={onClose}
          />
        ) : (
          <RecoveryCodesView codes={codes} onDone={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
