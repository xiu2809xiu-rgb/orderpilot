import { Check, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { CodeFieldState } from "@/components/kit/code-field/CodeField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface RecoveryCodeFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Said under the field when it was sent empty. */
  error?: string;
  /**
   * A try is being checked. The input stays focusable but cannot be edited:
   * a disabled input would drop the keyboard's focus to the page and never
   * give it back.
   */
  busy?: boolean;
  /** `verifying` and `success` say so, in words, where the six cells would. */
  state?: CodeFieldState;
  describedBy?: string;
}

/** One recovery code, typed as printed. The server ignores case, spaces and hyphens. */
export function RecoveryCodeField({
  id,
  value,
  onChange,
  error,
  busy = false,
  state = "input",
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
  const checking = state === "verifying";
  const done = state === "success";
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{t("twoStep.recovery.label")}</Label>
      <Input
        ref={input}
        id={id}
        type="text"
        value={value}
        readOnly={busy}
        aria-readonly={busy ? true : undefined}
        autoComplete="off"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        maxLength={40}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        className="font-mono uppercase pointer-coarse:h-11"
        onChange={(event) => {
          if (!busy) onChange(event.target.value);
        }}
      />
      {/* The hint and the status share one cell, so the form does not jump. */}
      <div className="grid">
        <p
          id={hintId}
          className={cn(
            "fs-12 text-muted-foreground col-start-1 row-start-1",
            (checking || done) && "invisible",
          )}
        >
          {t("twoStep.recovery.hint")}
        </p>
        <p
          role="status"
          className={cn(
            "fs-12 col-start-1 row-start-1 flex items-center gap-1",
            done ? "text-success" : "text-muted-foreground",
          )}
        >
          {checking ? (
            <>
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 animate-spin motion-reduce:animate-none"
              />
              {t("twoStep.recovery.verifying")}
            </>
          ) : null}
          {done ? (
            <>
              <Check aria-hidden="true" className="size-3.5" />
              {t("twoStep.recovery.verified")}
            </>
          ) : null}
        </p>
      </div>
      {error ? (
        <p id={errorId} className="fs-14 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
