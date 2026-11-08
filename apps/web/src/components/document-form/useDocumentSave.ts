import type {
  DefaultValues,
  FieldValues,
  UseFormReturn,
} from "react-hook-form";
import { useReportFailure } from "./useReportFailure";
import { useFormSave, useSaveShortcut, type PathMap } from "@/components/form";
import type { DraftControl } from "@/components/form";

export interface DocumentSaveOptions<T extends FieldValues, O, R> {
  /** Sends the checked values. The server's refusals land on the fields. */
  onSave: (values: O, andNew: boolean) => Promise<R>;
  /** Runs after the form is clean: navigate, or start the next document. */
  onSaved?: (result: R, andNew: boolean) => void | Promise<void>;
  draft: DraftControl;
  /** The next document's blank values, for Save and new. */
  nextValues?: (() => DefaultValues<T>) | undefined;
  serverPaths?: PathMap | undefined;
  /** Why saving is not allowed now, or undefined. */
  blockedReason?: string | undefined;
  allowClean?: boolean | undefined;
}

/**
 * The two saves of a document form, both through the form kit so the server's
 * messages, the draft and the clean state behave as in every form, and Ctrl+S
 * for the first. Pass `blockedReason` when the role has no usable Save, and Ctrl+S stays inert.
 */
export function useDocumentSave<T extends FieldValues, O, R>(
  form: UseFormReturn<T, unknown, O>,
  options: DocumentSaveOptions<T, O, R>,
): { save: () => Promise<void>; saveNew: () => Promise<void> } {
  const {
    onSave,
    onSaved,
    draft,
    serverPaths,
    blockedReason,
    allowClean,
    nextValues,
  } = options;
  const report = useReportFailure();
  // The form is clean by then, and react-hook-form would rethrow a failure of
  // the screen's own follow-up into a click handler with no one to tell.
  const afterSave = async (result: R, andNew: boolean) => {
    try {
      if (andNew && nextValues) {
        // The saved document stays saved; the form becomes the next, blank one,
        // and the draft of the old values must not come back on a reload.
        form.reset(nextValues());
        draft.clear();
      }
      await onSaved?.(result, andNew);
    } catch (error) {
      report(error);
    }
  };
  const common = { draft, ...(serverPaths ? { serverPaths } : {}) };
  const save = useFormSave(form, {
    ...common,
    onSave: (values) => onSave(values, false),
    onSaved: (result) => afterSave(result, false),
  });
  const saveNew = useFormSave(form, {
    ...common,
    onSave: (values) => onSave(values, true),
    onSaved: (result) => afterSave(result, true),
  });
  useSaveShortcut(form, save, {
    ...(blockedReason ? { blockedReason } : {}),
    ...(allowClean ? { allowClean } : {}),
  });
  return { save, saveNew };
}
