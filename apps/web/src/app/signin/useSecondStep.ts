import type { Session, TwoStepVerifyResponse } from "@orderpilot/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/common/toast";
import { finishSignIn } from "@/lib/api/auth";
import type { TwoStepFailure } from "../two-step/twoStepFailure";

interface Options {
  onSignedIn?: (session: Session) => void;
  /** The step closed; `ended` is the failure to show when the server ended the sign-in. */
  onClosed: (ended: TwoStepFailure | null) => void;
  /** The step opened: any older failure goes. */
  onOpened: () => void;
}

/**
 * The state around the second step of a password sign-in. While it is open the
 * rest of the form stays mounted and is only hidden, so the email keeps its
 * place for "Back". The two signals tell the password field to empty (the
 * password must not sit in a hidden field) and to take focus again.
 */
export function useSecondStep({ onSignedIn, onClosed, onOpened }: Options) {
  const { t } = useTranslation("signin");
  const [open, setOpen] = useState(false);
  const [clearSignal, setClearSignal] = useState(0);
  const [focusSignal, setFocusSignal] = useState(0);

  return {
    open,
    clearSignal,
    focusSignal,
    openStep: () => {
      onOpened();
      setClearSignal((n) => n + 1);
      setOpen(true);
    },
    closeStep: (ended: TwoStepFailure | null) => {
      setOpen(false);
      setFocusSignal((n) => n + 1);
      onClosed(ended);
    },
    /** The code was right and the green hold is over: only now is the session adopted. */
    verified: (response: TwoStepVerifyResponse) => {
      const session = finishSignIn(response.data);
      const { method, recoveryCodesLeft, lockedRecently } = response.meta;
      if (method === "recovery-code") {
        toast.done(
          recoveryCodesLeft === 0
            ? t("twoStep.recoveryUsedLast")
            : t("twoStep.recoveryUsed", { count: recoveryCodesLeft }),
        );
      }
      if (lockedRecently) toast.done(t("twoStep.recentLock"));
      onSignedIn?.(session);
    },
  };
}
