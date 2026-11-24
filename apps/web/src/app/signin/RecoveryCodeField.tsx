import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RecoveryCodeFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Said under the field when it was sent empty. */
  error?: string;
  disabled?: boolean;
  describedBy?: string;
}

/** One recovery code, typed as printed. The server ignores case, spaces and hyphens. */
export function RecoveryCodeField({
  id,
  value,
  onChange,
  error,
  disabled,
  describedBy,
}: RecoveryCodeFieldProps) {
  const { t } = useTranslation("signin");
  const input = useRef<HTMLInputElement>(null);
  // The field replaces the six cells after a tap, so focus follows it.
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = [hintId, error ? errorId : "", describedBy ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("twoStep.recovery.label")}</Label>
      <Input
        ref={input}
        id={id}
        type="text"
        value={value}
        disabled={disabled}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={40}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className="font-mono uppercase pointer-coarse:h-11"
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
      <p id={hintId} className="fs-12 text-muted-foreground">
        {t("twoStep.recovery.hint")}
      </p>
      {error ? (
        <p id={errorId} className="fs-14 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
