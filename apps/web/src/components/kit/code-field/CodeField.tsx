// Kit: "OTP Input Verification" design by bestsaasdesigns (https://x.com/bestsaasdesigns/status/2111020282551132539), bundle supplied 24 Nov 2026, no licence stated. A port, not the bundle: no GSAP, no shadow root, no embedded font, no icons carried. Adapted to OrderPilot's tokens.
import { Check, LoaderCircle } from "lucide-react";
import { useId, type Ref } from "react";
import { cn } from "@/lib/utils";
import { CODE_LENGTH } from "./codeFieldMotion";
import { useCodeField, type CodeFieldState } from "./useCodeField";
import { useRingSpring } from "./useRingSpring";
import "./codeField.css";

export type { CodeFieldState } from "./useCodeField";

/** The field's words. The kit calls no translation: the parent passes them. */
export interface CodeFieldLabels {
  /** The name of the group of cells. */
  group: string;
  /** The name of the one real input. */
  input: string;
  /** A line under the field, tied to the input. Not drawn when absent. */
  hint?: string;
  /** The pill's word while a code is checked. */
  verifying: string;
  /** The pill's word when the code was right. */
  verified: string;
  /** Said by the live region while a code is checked. */
  statusVerifying: string;
  /** Said by the live region when the code was right. */
  statusVerified: string;
  /** Said by the live region when the code was wrong. */
  statusWrong: string;
}

export interface CodeFieldProps {
  /** The digits typed so far, at most six. The parent owns them. */
  value: string;
  /** Which of the four faces to draw. The parent changes it and times it. */
  state?: CodeFieldState;
  /** Every change of the digits, already reduced to digits and six at most. */
  onChange: (value: string) => void;
  /** The sixth digit was typed, pasted or filled in. */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  labels: CodeFieldLabels;
  /** The id of anything else that describes the field, such as a failure alert. */
  describedBy?: string;
  /** The input's id, for a label elsewhere that points at it. */
  id?: string;
  /** Moves focus into the input when the field appears. */
  focusOnMount?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}

function statusText(state: CodeFieldState, labels: CodeFieldLabels): string {
  if (state === "verifying") return labels.statusVerifying;
  if (state === "success") return labels.statusVerified;
  if (state === "error") return labels.statusWrong;
  return "";
}

/**
 * Six drawn cells over one real input (inputmode numeric, one-time-code), so
 * typing, pasting, the browser's autofill and a screen reader all meet a
 * normal text box. The shell unfolds from a pill when the field appears,
 * folds back to the pill with a spinner while a code is checked, shakes red
 * for a wrong one and turns green for the right one. It is controlled: the
 * parent holds the value, says which of `input`, `verifying`, `error` and
 * `success` to draw, and times each one. The field is one touch target as
 * tall as `--cf-h` (56 px) and as wide as its parent, down to a 240 px dialog.
 */
export function CodeField({
  value,
  state = "input",
  onChange,
  onComplete,
  disabled = false,
  labels,
  describedBy,
  id,
  focusOnMount = false,
  inputRef,
  className,
}: CodeFieldProps) {
  const own = useId();
  const hintId = `${own}-hint`;
  const statusId = `${own}-status`;
  const field = useCodeField({
    value,
    state,
    disabled,
    focusOnMount,
    onChange,
    onComplete,
    inputRef,
  });
  const ring = useRingSpring(field.active);
  const caret =
    field.focused && state === "input" && !value[field.active] && !disabled;
  const described = [labels.hint ? hintId : "", statusId, describedBy ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={cn("cf", className)}
      data-state={state}
      data-focused={field.focused ? "true" : undefined}
      data-disabled={disabled ? "true" : undefined}
      data-intro={field.intro ? "true" : undefined}
    >
      <div role="group" aria-label={labels.group} className="cf-field">
        <div
          className="cf-shell"
          onAnimationEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.animationName === "cf-unfold"
            ) {
              field.endIntro();
            }
          }}
        >
          <div className="cf-cells" aria-hidden="true">
            {Array.from({ length: CODE_LENGTH }, (_, cell) => (
              <span key={cell} className="cf-cell">
                {value[cell] ? (
                  <span
                    key={value[cell]}
                    className="cf-digit fs-28 numeral"
                    data-digit
                  >
                    {value[cell]}
                  </span>
                ) : null}
              </span>
            ))}
            <span
              ref={ring}
              className="cf-ring"
              data-caret={caret || undefined}
            >
              <span className="cf-caret" />
            </span>
          </div>
          <input
            ref={field.setNode}
            id={id}
            className="cf-input"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={value}
            readOnly={!field.editable}
            disabled={disabled}
            aria-label={labels.input}
            aria-invalid={state === "error"}
            aria-describedby={described}
            {...field.inputProps}
          />
          <span className="cf-pill cf-verifying" aria-hidden="true">
            <LoaderCircle className="cf-spinner" size={18} />
            <span>{labels.verifying}</span>
          </span>
          <span className="cf-pill cf-success" aria-hidden="true">
            <Check size={18} strokeWidth={2.5} />
            <span>{labels.verified}</span>
          </span>
        </div>
      </div>
      {labels.hint ? (
        <p id={hintId} className="cf-hint dx-meta">
          {labels.hint}
        </p>
      ) : null}
      <span id={statusId} className="sr-only" role="status" aria-live="polite">
        {statusText(state, labels)}
      </span>
    </div>
  );
}
