import type { TwoStepVerifyResponse } from "@orderpilot/shared";
import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeField } from "@/components/kit/code-field/CodeField";
import { Button } from "@/components/ui/button";
import { verifyTwoStep } from "@/lib/api/two-step";
import { ShortCodeNote } from "../two-step/ShortCodeNote";
import { useCodeFieldLabels } from "../two-step/useCodeFieldLabels";
import { useShortCode } from "../two-step/useShortCode";
import { useCodeAttempt, type FailureKind } from "../two-step/useCodeAttempt";
import {
  describeTwoStepFailure,
  isChallengeEnded,
  isWrongCode,
  type TwoStepFailure,
  type TwoStepMode,
} from "../two-step/twoStepFailure";
import { RecoveryCodeField } from "./RecoveryCodeField";
import { TwoStepAlert } from "./TwoStepAlert";

interface TwoStepStepProps {
  idPrefix: string;
  /** The code was right and the green hold is over. The parent adopts the session. */
  onVerified: (response: TwoStepVerifyResponse) => void;
  /** The server ended this sign-in: the parent returns to the password form. */
  onEnded: (failure: TwoStepFailure) => void;
  onBack: () => void;
}

/**
 * The second step of a sign-in: the six-digit code from the authenticator app,
 * or one recovery code. While a code is checked, and after it was right until
 * the session is adopted, Verify, the switch and Back are all disabled: the
 * server has already issued the cookies by then, and a click on Back would
 * leave them under a page that shows the password form.
 */
export function TwoStepStep({
  idPrefix,
  onVerified,
  onEnded,
  onBack,
}: TwoStepStepProps) {
  const { t } = useTranslation("signin");
  const { t: tCommon } = useTranslation();
  const labels = useCodeFieldLabels();
  const alertId = useId();
  const [mode, setMode] = useState<TwoStepMode>("app");
  const [recovery, setRecovery] = useState("");
  const [emptyRecovery, setEmptyRecovery] = useState(false);
  const [failure, setFailure] = useState<TwoStepFailure | null>(null);
  const short = useShortCode();
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const attempt = useCodeAttempt({
    submit: (proof) =>
      verifyTwoStep(
        modeRef.current === "app" ? { code: proof } : { recoveryCode: proof },
      ),
    onDone: onVerified,
    onFail: (error): FailureKind => {
      const described = describeTwoStepFailure(
        error,
        tCommon,
        t,
        modeRef.current,
      );
      if (isChallengeEnded(error)) {
        onEnded(described);
        return "plain";
      }
      setFailure(described);
      // A wrong code shakes and clears. A network error keeps the digits so
      // that Verify is the retry.
      return isWrongCode(error) && modeRef.current === "app"
        ? "wrong"
        : "plain";
    },
  });

  function submit() {
    if (attempt.busy || attempt.state !== "input") return;
    if (mode === "app") {
      if (attempt.value.length === 6) attempt.run(attempt.value);
      else short.show();
      return;
    }
    if (recovery.trim() === "") {
      setEmptyRecovery(true);
      return;
    }
    setFailure(null);
    attempt.run(recovery.trim());
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <p role="status" className="sr-only">
        {t("twoStep.shown")}
      </p>
      <div className="flex flex-col gap-1">
        <h2 className="fs-18 font-semibold">{t("twoStep.title")}</h2>
        <p className="fs-14 text-muted-foreground">{t("twoStep.intro")}</p>
      </div>
      {mode === "app" ? (
        <CodeField
          id={`${idPrefix}-code`}
          value={attempt.value}
          state={attempt.state}
          focusOnMount
          inputRef={short.inputRef}
          describedBy={short.describedBy(failure ? alertId : undefined)}
          labels={labels}
          onChange={(next) => {
            setFailure(null);
            short.clear();
            attempt.setValue(next);
          }}
          onComplete={(code) => {
            attempt.run(code);
          }}
        />
      ) : (
        <RecoveryCodeField
          id={`${idPrefix}-recovery`}
          value={recovery}
          busy={attempt.busy}
          state={attempt.state}
          error={emptyRecovery ? t("twoStep.recovery.required") : undefined}
          describedBy={failure ? alertId : undefined}
          onChange={(next) => {
            setEmptyRecovery(false);
            setFailure(null);
            setRecovery(next);
          }}
        />
      )}
      {mode === "app" && short.short ? (
        <ShortCodeNote id={short.noteId} />
      ) : null}
      {failure ? <TwoStepAlert failure={failure} id={alertId} /> : null}
      <Button
        type="submit"
        className="w-full pointer-coarse:h-11"
        disabled={attempt.busy}
      >
        {t("twoStep.submit")}
      </Button>
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="ghost"
          className="w-full pointer-coarse:h-11"
          disabled={attempt.busy}
          onClick={() => {
            setFailure(null);
            setEmptyRecovery(false);
            short.clear();
            attempt.reset();
            setMode(mode === "app" ? "recovery" : "app");
          }}
        >
          {mode === "app" ? t("twoStep.useRecovery") : t("twoStep.useApp")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full pointer-coarse:h-11"
          disabled={attempt.busy}
          onClick={onBack}
        >
          {t("twoStep.back")}
        </Button>
      </div>
    </form>
  );
}
