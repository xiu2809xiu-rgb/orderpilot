import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DemoField } from "./demoDocument";
import { checkEdit, fieldKind, type EditRefusal } from "./fieldKind";

/**
 * The edit of one field: a labelled input with a help line for its kind, and
 * Save and Cancel. A value that does not fit the field's kind is refused here:
 * the message sits at the field and is tied to it for a screen reader, the old
 * value stays, and the field is not confirmed. Saving a good value hands the
 * trimmed text up, which confirms it.
 */
export function FieldEdit({
  field,
  value,
  onSave,
  onCancel,
}: {
  field: Pick<DemoField, "key" | "label">;
  /** The value now shown, which the draft starts from. */
  value: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("directions-intake");
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const [refusal, setRefusal] = useState<EditRefusal | null>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);

  const save = () => {
    const result = checkEdit(field.key, draft);
    if (result.ok) {
      onSave(result.text);
      return;
    }
    setRefusal(result.reason);
    input.current?.focus();
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="fs-14 font-medium">
        {t("review.editLabel", { label: field.label })}
      </label>
      <Input
        ref={input}
        id={inputId}
        value={draft}
        aria-invalid={refusal !== null}
        aria-describedby={refusal ? `${helpId} ${errorId}` : helpId}
        onChange={(event) => {
          setDraft(event.target.value);
          setRefusal(null);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
          // Escape leaves the field alone, and must not close anything around it.
          if (event.key === "Escape") {
            event.stopPropagation();
            onCancel();
          }
        }}
        className="fs-14"
      />
      <p id={helpId} className="fs-12 text-muted-foreground">
        {t(`review.editHelp.${fieldKind(field.key)}`)}
      </p>
      {refusal ? (
        <p id={errorId} role="alert" className="fs-14 text-destructive">
          {t(`review.editError.${refusal}`)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={save}
          className="pointer-coarse:h-11"
        >
          {t("review.save")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="pointer-coarse:h-11"
        >
          {t("review.cancel")}
        </Button>
      </div>
    </div>
  );
}
