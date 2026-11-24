import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RecoveryCodeField } from "@/app/signin/RecoveryCodeField";
import { TwoStepAlert } from "@/app/signin/TwoStepAlert";
import {
  describeTwoStepFailure,
  isWrongCode,
  type TwoStepFailure,
} from "@/app/two-step/twoStepFailure";
import { useCodeFieldLabels } from "@/app/two-step/useCodeFieldLabels";
import {
  useCodeAttempt,
  type FailureKind,
} from "@/app/two-step/useCodeAttempt";
import { CodeField } from "@/components/kit/code-field/CodeField";
import { ApiError } from "@/lib/api/errors";
import { DialogPasswordField } from "./DialogPasswordField";
import { ProofFormButtons } from "./ProofFormButtons";
import type { TwoStepProofFormProps } from "./twoStepProofTypes";

/**
 * The field, the failure and the buttons that every proof of a code shares:
 * turning on (the first code), turning off, and new recovery codes. The
 * attempt hook times the holds, so a result is seen before it is used.
 */
export function TwoStepProofForm<T>({
  idPrefix,
  send,
  onDone,
  onSetupEnded,
  needsPassword = false,
  allowRecovery = false,
  submitLabel,
  cancelLabel,
  onCancel,
  onBusy,
}: TwoStepProofFormProps<T>) {
  const { t } = useTranslation("settings");
  const { t: tSignin } = useTranslation("signin");
  const { t: tCommon } = useTranslation();
  const labels = useCodeFieldLabels();
  const alertId = useId();
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recovery, setRecovery] = useState("");
  const [password, setPassword] = useState("");
  const [passwordFocus, setPasswordFocus] = useState(0);
  const [needs, setNeeds] = useState<"password" | "recovery" | null>(null);
  const [failure, setFailure] = useState<TwoStepFailure | null>(null);
  const live = useRef({ recoveryMode, password });
  live.current = { recoveryMode, password };

  const attempt = useCodeAttempt({
    submit: (proof) =>
      send(
        live.current.recoveryMode ? { recoveryCode: proof } : { code: proof },
        needsPassword ? live.current.password : undefined,
      ),
    onDone,
    onFail: (error): FailureKind => {
      const described = describeTwoStepFailure(error, tCommon, tSignin);
      if (error instanceof ApiError && error.code === "TWO_STEP_SETUP_ENDED") {
        onSetupEnded?.(described);
        return "plain";
      }
      setFailure(described);
      if (error instanceof ApiError && error.code === "PASSWORD_INCORRECT") {
        // A wrong password costs no code try, so the digits stay for the retry.
        setPassword("");
        setPasswordFocus((n) => n + 1);
        return "plain";
      }
      return isWrongCode(error) && !live.current.recoveryMode
        ? "wrong"
        : "plain";
    },
  });

  const { busy } = attempt;
  useEffect(() => {
    onBusy?.(busy);
  }, [busy, onBusy]);

  function start(proof: string) {
    if (needsPassword && password === "") {
      setNeeds("password");
      setPasswordFocus((n) => n + 1);
      return;
    }
    setNeeds(null);
    setFailure(null);
    attempt.run(proof);
  }

  function submit() {
    if (attempt.busy || attempt.state !== "input") return;
    if (!recoveryMode) {
      if (attempt.value.length === 6) start(attempt.value);
    } else if (recovery.trim() === "") {
      setNeeds("recovery");
    } else {
      start(recovery.trim());
    }
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
      {needsPassword ? (
        <DialogPasswordField
          id={`${idPrefix}-password`}
          value={password}
          disabled={attempt.busy}
          focusSignal={passwordFocus}
          error={
            needs === "password"
              ? t("account.twoStep.password.required")
              : undefined
          }
          onChange={(next) => {
            setNeeds(null);
            setPassword(next);
          }}
        />
      ) : null}
      {recoveryMode ? (
        <RecoveryCodeField
          id={`${idPrefix}-recovery`}
          value={recovery}
          disabled={attempt.busy}
          error={
            needs === "recovery"
              ? tSignin("twoStep.recovery.required")
              : undefined
          }
          describedBy={failure ? alertId : undefined}
          onChange={(next) => {
            setNeeds(null);
            setFailure(null);
            setRecovery(next);
          }}
        />
      ) : (
        <CodeField
          id={`${idPrefix}-code`}
          value={attempt.value}
          state={attempt.state}
          focusOnMount={!needsPassword}
          describedBy={failure ? alertId : undefined}
          labels={labels}
          onChange={(next) => {
            setFailure(null);
            attempt.setValue(next);
          }}
          onComplete={start}
        />
      )}
      {failure ? <TwoStepAlert failure={failure} id={alertId} /> : null}
      <ProofFormButtons
        busy={attempt.busy}
        submitLabel={submitLabel}
        cancelLabel={cancelLabel}
        onCancel={onCancel}
        toggleLabel={
          allowRecovery
            ? tSignin(recoveryMode ? "twoStep.useApp" : "twoStep.useRecovery")
            : undefined
        }
        onToggle={() => {
          setFailure(null);
          setNeeds(null);
          attempt.reset();
          setRecoveryMode((now) => !now);
        }}
      />
    </form>
  );
}
