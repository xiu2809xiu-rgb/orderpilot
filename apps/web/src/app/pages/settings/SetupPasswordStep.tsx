import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { TwoStepAlert } from "@/app/signin/TwoStepAlert";
import type { TwoStepFailure } from "@/app/two-step/twoStepFailure";
import { Button } from "@/components/ui/button";
import { DialogPasswordField } from "./DialogPasswordField";

interface SetupPasswordStepProps {
  /** A password session asks for the password again. A demo session has none. */
  needsPassword: boolean;
  starting: boolean;
  failure: TwoStepFailure | null;
  /** Changes when the password was wrong: the field empties and takes focus. */
  wrongPasswordSignal: number;
  onContinue: (password: string | undefined) => void;
  onCancel: () => void;
}

/** Step one of turning on: the password again, or for a demo session only the way to start (again). */
export function SetupPasswordStep({
  needsPassword,
  starting,
  failure,
  wrongPasswordSignal,
  onContinue,
  onCancel,
}: SetupPasswordStepProps) {
  const { t } = useTranslation("settings");
  const alertId = useId();
  const [password, setPassword] = useState("");
  const [empty, setEmpty] = useState(false);
  // A wrong password empties the field. Compared during render, so no effect
  // is needed: the signal is the only thing that moves.
  const [seen, setSeen] = useState(wrongPasswordSignal);
  if (seen !== wrongPasswordSignal) {
    setSeen(wrongPasswordSignal);
    setPassword("");
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!needsPassword) {
          onContinue(undefined);
        } else if (password === "") {
          setEmpty(true);
        } else {
          onContinue(password);
        }
      }}
    >
      {needsPassword ? (
        <>
          <DialogPasswordField
            id="two-step-setup-password"
            value={password}
            disabled={starting}
            focusSignal={wrongPasswordSignal}
            error={empty ? t("account.twoStep.password.required") : undefined}
            onChange={(next) => {
              setEmpty(false);
              setPassword(next);
            }}
          />
          <p className="fs-12 text-muted-foreground">
            {t("account.twoStep.password.help")}
          </p>
        </>
      ) : null}
      {failure ? <TwoStepAlert failure={failure} id={alertId} /> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={starting}
          onClick={onCancel}
        >
          {t("account.twoStep.setup.cancel")}
        </Button>
        <Button type="submit" disabled={starting}>
          {needsPassword
            ? t("account.twoStep.setup.continue")
            : t("account.twoStep.setup.restart")}
        </Button>
      </div>
    </form>
  );
}
