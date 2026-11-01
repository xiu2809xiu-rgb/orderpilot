import type { ComponentProps } from "react";
import { useId } from "react";
import {
  useFormState,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface SaveButtonProps<T extends FieldValues, O> {
  form: UseFormReturn<T, unknown, O>;
  onSave: () => void | Promise<void>;
  label?: string;
  /** Why saving is not allowed now, in words for the person. */
  blockedReason?: string;
  /** The default is the page's primary button: a page has only one. */
  variant?: ComponentProps<typeof Button>["variant"];
}

/**
 * Save, wherever the page puts it: inside the form or up in an action bar. It
 * is never plain `disabled`: it stays in the Tab order and says why it cannot
 * run, and invalid fields still get their say when it is pressed.
 */
export function SaveButton<T extends FieldValues, O = T>({
  form,
  onSave,
  label,
  blockedReason,
  variant,
}: SaveButtonProps<T, O>) {
  const { t } = useTranslation("form");
  const { isDirty, isSubmitting } = useFormState({ control: form.control });
  const reasonId = useId();
  const reason = blockedReason ?? (isDirty ? undefined : t("save.noChanges"));
  const blocked = reason !== undefined || isSubmitting;
  return (
    <>
      {reason === undefined ? null : (
        <span id={reasonId} className="text-xs text-muted-foreground">
          {reason}
        </span>
      )}
      <Button
        type="button"
        variant={variant}
        aria-disabled={blocked}
        aria-describedby={reason === undefined ? undefined : reasonId}
        className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        onClick={() => {
          if (!blocked) void onSave();
        }}
      >
        {isSubmitting ? t("save.saving") : (label ?? t("save.label"))}
      </Button>
    </>
  );
}
