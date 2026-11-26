import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface RejectReasonListProps {
  /** Prefix for the element ids, shared with the note field and the problem line. */
  id: string;
  reasons: readonly string[];
  reason: string;
  invalid: boolean;
  groupRef: RefObject<HTMLDivElement | null>;
  onReason: (next: string) => void;
}

/** The short list of reasons a reviewer chooses from, as one radio group. */
export function RejectReasonList({
  id,
  reasons,
  reason,
  invalid,
  groupRef,
  onReason,
}: RejectReasonListProps) {
  const { t } = useTranslation("settings");
  return (
    <div className="flex flex-col gap-s2">
      <p id={`${id}-reason`} className="fs-14 font-medium">
        {t("pictures.dialog.reason")}
      </p>
      <RadioGroup
        ref={groupRef}
        value={reason}
        aria-labelledby={`${id}-reason`}
        aria-required="true"
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-problem` : undefined}
        onValueChange={onReason}
        className="gap-s1"
      >
        {reasons.map((code) => (
          <div
            key={code}
            className="flex min-h-9 items-start gap-s2 pointer-coarse:min-h-11"
          >
            <RadioGroupItem
              id={`${id}-${code}`}
              value={code}
              className="mt-1 size-4 shrink-0 rounded-full border border-input data-[state=checked]:border-4 data-[state=checked]:border-ring pointer-coarse:mt-3"
            />
            <Label
              htmlFor={`${id}-${code}`}
              className="fs-14 flex-1 cursor-pointer items-start py-1 leading-snug font-normal pointer-coarse:py-3"
            >
              {t(`pictures.reasons.${code}`)}
            </Label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
