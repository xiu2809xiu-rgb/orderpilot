import { QRCodeSVG } from "qrcode.react";
import { useTranslation } from "react-i18next";
import type { TwoStepFailure } from "@/app/two-step/twoStepFailure";
import { CopyButton } from "@/components/common/CopyButton";
import { Alert, AlertTitle } from "@/components/kit/Alert";
import { TWO_STEP_SETUP_MINUTES } from "@orderpilot/shared";
import { enableTwoStep } from "@/lib/api/two-step";
import { TwoStepProofForm } from "./TwoStepProofForm";

export type EnabledAnswer = Awaited<ReturnType<typeof enableTwoStep>>;

interface SetupScanStepProps {
  setupKey: string;
  otpauthUri: string;
  /** A demo session turns this on for a shared account, and is told so. */
  demo: boolean;
  onEnabled: (answer: EnabledAnswer) => void;
  onSetupEnded: (failure: TwoStepFailure) => void;
  onBusy: (busy: boolean) => void;
  onCancel: () => void;
}

/** The setup key in groups of four, so it can be read out and typed. */
function grouped(key: string): string {
  return key.match(/.{1,4}/g)?.join(" ") ?? key;
}

/**
 * Step two: the QR code, the same key as text, and the first six-digit code.
 * The QR is black on white in both themes, because a scanner needs dark
 * modules on a light ground. It is 176 px, which fits the 240 px a dialog
 * has on a 320 px screen.
 */
export function SetupScanStep({
  setupKey,
  otpauthUri,
  demo,
  onEnabled,
  onSetupEnded,
  onBusy,
  onCancel,
}: SetupScanStepProps) {
  const { t } = useTranslation("settings");
  return (
    <div className="flex flex-col gap-4">
      {demo ? (
        <Alert variant="warning">
          <AlertTitle>{t("account.twoStep.setup.demoWarning")}</AlertTitle>
        </Alert>
      ) : null}
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-md bg-white">
          <QRCodeSVG
            value={otpauthUri}
            size={176}
            level="M"
            marginSize={4}
            title={t("account.twoStep.setup.qrTitle")}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
        <div className="flex w-full min-w-0 flex-col gap-1">
          <p className="fs-12 text-muted-foreground">
            {t("account.twoStep.setup.keyLabel")}
          </p>
          <div className="flex items-start gap-1">
            <code
              data-testid="setup-key"
              className="fs-14 min-w-0 font-mono tracking-wide break-all"
            >
              {grouped(setupKey)}
            </code>
            <CopyButton
              value={setupKey}
              what={t("account.twoStep.setup.keyCopy")}
            />
          </div>
          <p className="fs-12 text-muted-foreground">
            {t("account.twoStep.setup.expires", {
              minutes: TWO_STEP_SETUP_MINUTES,
            })}
          </p>
        </div>
      </div>
      <p className="fs-14 font-medium">
        {t("account.twoStep.setup.codeLabel")}
      </p>
      <TwoStepProofForm
        idPrefix="two-step-setup"
        send={(proof) =>
          "code" in proof
            ? enableTwoStep(proof.code)
            : Promise.reject(new Error("A code is needed to turn on."))
        }
        onDone={onEnabled}
        onSetupEnded={onSetupEnded}
        onBusy={onBusy}
        submitLabel={t("account.twoStep.turnOn")}
        cancelLabel={t("account.twoStep.setup.cancel")}
        onCancel={onCancel}
      />
    </div>
  );
}
