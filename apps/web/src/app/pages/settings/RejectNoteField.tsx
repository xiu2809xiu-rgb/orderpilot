import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { PICTURE_NOTE_MAX } from "@orderpilot/shared";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface RejectNoteFieldProps {
  /** Prefix for the element ids, shared with the reason list and the problem line. */
  id: string;
  /** The owner's name, for the hint about who reads the note. */
  name: string;
  note: string;
  /** "Another reason" makes the note required. */
  required: boolean;
  invalid: boolean;
  fieldRef: RefObject<HTMLTextAreaElement | null>;
  onNote: (next: string) => void;
}

/** The note the owner will read beside the reason. It is never drafted anywhere. */
export function RejectNoteField({
  id,
  name,
  note,
  required,
  invalid,
  fieldRef,
  onNote,
}: RejectNoteFieldProps) {
  const { t } = useTranslation("settings");
  return (
    <div className="flex flex-col gap-s1">
      <Label htmlFor={`${id}-note`}>
        {required
          ? t("pictures.dialog.noteRequired")
          : t("pictures.dialog.note")}
      </Label>
      <Textarea
        ref={fieldRef}
        id={`${id}-note`}
        rows={3}
        maxLength={PICTURE_NOTE_MAX}
        value={note}
        aria-required={required ? "true" : undefined}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint${invalid ? ` ${id}-problem` : ""}`}
        onChange={(event) => {
          onNote(event.target.value);
        }}
      />
      <p id={`${id}-hint`} className="fs-14 text-muted-foreground">
        {t("pictures.dialog.noteHint", { name })}
      </p>
    </div>
  );
}
