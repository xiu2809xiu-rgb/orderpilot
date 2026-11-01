import type { ComponentProps } from "react";
import { useId } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useSaveReason, type SaveOptions } from "./useSaveReason";

interface SaveButtonProps<T extends FieldValues, O> extends SaveOptions {
  form: UseFormReturn<T, unknown, O>;
  onSave: () => void | Promise<void>;
  label?: string;
  /** The default is the page's primary button: a page has only one. */
  variant?: ComponentProps<typeof Button>["variant"];
}

/**
 * Save, wherever the page puts it: inside the form or up in an action bar. It
 * is never plain `disabled`: it stays in the Tab order and says why it cannot
 * run, and invalid fields still get their say when it is pressed. Give
 * `useSaveShortcut` the same `blockedReason` and `allowClean`.
 */
export function SaveButton<T extends FieldValues, O = T>({
  form,
  onSave,
  label,
  blockedReason,
  allowClean,
  variant,
}: SaveButtonProps<T, O>) {
  const { t } = useTranslation("form");
  const reasonId = useId();
  const { reason, ready, isSubmitting } = useSaveReason(form, {
    blockedReason,
    allowClean,
  });
  const blocked = !ready;
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
