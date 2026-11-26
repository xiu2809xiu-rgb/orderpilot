import { Eye, EyeOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DialogPasswordFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  /** Changes when the field should take focus, such as after a wrong password. */
  focusSignal?: number;
}

/**
 * The password again, before a two-step change. It is plain state in the
 * dialog that is open: never a draft, never in a query key, never in a toast.
 */
export function DialogPasswordField({
  id,
  value,
  onChange,
  error,
  disabled,
  focusSignal = 0,
}: DialogPasswordFieldProps) {
  const { t } = useTranslation("settings");
  const [shown, setShown] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSignal > 0) input.current?.focus({ preventScroll: true });
  }, [focusSignal]);
  const errorId = `${id}-error`;
  const EyeIcon = shown ? EyeOff : Eye;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("account.twoStep.password.label")}</Label>
      <div className="relative">
        <Input
          ref={input}
          id={id}
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="pr-11 pointer-coarse:h-11"
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute inset-y-0 right-0 size-9 pointer-coarse:size-11"
          aria-label={t("account.twoStep.password.show")}
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => {
            setShown((now) => !now);
          }}
        >
          <EyeIcon aria-hidden="true" />
        </Button>
      </div>
      {error ? (
        <p id={errorId} className="fs-14 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
