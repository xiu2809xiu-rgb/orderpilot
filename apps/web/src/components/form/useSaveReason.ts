import {
  useFormState,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useViewerChanged } from "./useViewerChanged";

export interface SaveOptions {
  /** Why saving is not allowed now, in words for the person. */
  blockedReason?: string;
  /**
   * Lets an unchanged form save. For a form filled in by its defaults, such as
   * an SPR raised from a shortage line or a copy of an order, where saving the
   * values as they stand is the whole point.
   */
  allowClean?: boolean;
}

/**
 * The one answer to "may this form save now?", for the Save button and for
 * Ctrl+S alike: give both the same options, and they never disagree.
 */
export function useSaveReason<T extends FieldValues, O = T>(
  form: UseFormReturn<T, unknown, O>,
  { blockedReason, allowClean = false }: SaveOptions = {},
): { reason: string | undefined; ready: boolean; isSubmitting: boolean } {
  const { t } = useTranslation("form");
  const { isDirty, isSubmitting } = useFormState({ control: form.control });
  const otherViewer = useViewerChanged();
  const reason = otherViewer
    ? t("viewer.saveBlocked")
    : (blockedReason ??
      (isDirty || allowClean ? undefined : t("save.noChanges")));
  return {
    reason,
    ready: reason === undefined && !isSubmitting,
    isSubmitting,
  };
}
