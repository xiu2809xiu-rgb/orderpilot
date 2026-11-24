import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  describeTwoStepFailure,
  type TwoStepFailure,
} from "@/app/two-step/twoStepFailure";
import { toast } from "@/components/common/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api/errors";
import { startTwoStepSetup } from "@/lib/api/two-step";
import { useRestoreFocus } from "@/lib/useRestoreFocus";
import { useSessionStore } from "@/stores/session";
import { RecoveryCodesView } from "./RecoveryCodesView";
import { SetupPasswordStep } from "./SetupPasswordStep";
import { SetupScanStep, type EnabledAnswer } from "./SetupScanStep";
import { twoStepStatusKey } from "./useTwoStepStatus";

interface Setup {
  setupKey: string;
  otpauthUri: string;
}

type Step = "start" | "scan" | "codes";

/**
 * Turning two-step on, in one dialog of three steps: the password again (not
 * for a demo session), the QR code and the first code, then the ten recovery
 * codes. The setup key and the codes live in this component's state only. The
 * card mounts the dialog while it is open, so closing it drops them, and
 * nothing is written to the query or mutation cache (ADR 0068). The last step
 * cannot be closed until the box is ticked and Done is pressed.
 */
export function TwoStepSetupDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("settings");
  const { t: tSignin } = useTranslation("signin");
  const { t: tCommon } = useTranslation();
  const queryClient = useQueryClient();
  const session = useSessionStore((state) => state.session);
  const demo = session?.demo === true;
  const focus = useRestoreFocus();
  const [step, setStep] = useState<Step>("start");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [failure, setFailure] = useState<TwoStepFailure | null>(null);
  // A demo session starts at once, so it never shows the empty first step.
  const [starting, setStarting] = useState(demo);
  const [wrongPassword, setWrongPassword] = useState(0);
  const [busy, setBusy] = useState(false);
  const autoStarted = useRef(false);

  async function begin(password: string | undefined) {
    setFailure(null);
    setStarting(true);
    try {
      const answer = await startTwoStepSetup(password);
      setSetup({ setupKey: answer.setupKey, otpauthUri: answer.otpauthUri });
      setStep("scan");
    } catch (error) {
      setFailure(describeTwoStepFailure(error, tCommon, tSignin));
      if (error instanceof ApiError && error.code === "PASSWORD_INCORRECT") {
        setWrongPassword((n) => n + 1);
      }
    } finally {
      setStarting(false);
    }
  }

  // A demo session has no password: it starts at once. The ref keeps
  // StrictMode's second mount from asking twice.
  useEffect(() => {
    if (demo && !autoStarted.current) {
      autoStarted.current = true;
      void begin(undefined);
    }
  }, [demo]);

  function enabled(answer: EnabledAnswer) {
    // The key is no longer needed: drop it before the codes are drawn.
    setSetup(null);
    setCodes(answer.recoveryCodes);
    queryClient.setQueryData(twoStepStatusKey(session?.user.id), answer.status);
    setStep("codes");
  }

  function setupEnded(ended: TwoStepFailure) {
    setSetup(null);
    setFailure(ended);
    setStep("start");
  }

  function finish() {
    toast.done(t("account.twoStep.turnedOn"));
    onClose();
  }

  const title =
    step === "scan"
      ? t("account.twoStep.setup.scanTitle")
      : step === "codes"
        ? t("account.twoStep.recoveryView.title")
        : t("account.twoStep.setup.title");
  const description =
    step === "scan"
      ? t("account.twoStep.setup.scanBody")
      : step === "codes"
        ? t("account.twoStep.recoveryView.body")
        : demo
          ? t("account.twoStep.setup.demoWarning")
          : t("account.twoStep.password.help");
  const locked = step === "codes";

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !locked && !busy && !starting) onClose();
      }}
    >
      <DialogContent
        showCloseButton={!locked}
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
        onEscapeKeyDown={(event) => {
          if (locked || busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (locked || busy) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {step === "start" && demo && starting ? (
          <div role="status" className="flex flex-col gap-2">
            <span className="sr-only">
              {t("account.twoStep.setup.preparing")}
            </span>
            <Skeleton aria-hidden="true" className="h-44 w-44 self-center" />
          </div>
        ) : null}
        {step === "start" && !(demo && starting) ? (
          <SetupPasswordStep
            needsPassword={!demo}
            starting={starting}
            failure={failure}
            wrongPasswordSignal={wrongPassword}
            onContinue={(password) => void begin(password)}
            onCancel={onClose}
          />
        ) : null}
        {step === "scan" && setup ? (
          <SetupScanStep
            setupKey={setup.setupKey}
            otpauthUri={setup.otpauthUri}
            demo={demo}
            onEnabled={enabled}
            onSetupEnded={setupEnded}
            onBusy={setBusy}
            onCancel={onClose}
          />
        ) : null}
        {step === "codes" ? (
          <RecoveryCodesView codes={codes} onDone={finish} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
