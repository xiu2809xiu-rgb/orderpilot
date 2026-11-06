import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useFormSave, useSaveShortcut, type PathMap } from "@/components/form";
import type { DraftControl } from "@/components/form";

export interface DocumentSaveOptions<O, R> {
  /** Sends the checked values. The server's refusals land on the fields. */
  onSave: (values: O, andNew: boolean) => Promise<R>;
  /** Runs after the form is clean: navigate, or start the next document. */
  onSaved?: (result: R, andNew: boolean) => void | Promise<void>;
  draft: DraftControl;
  serverPaths?: PathMap | undefined;
  /** Why saving is not allowed now, or undefined. */
  blockedReason?: string | undefined;
  allowClean?: boolean | undefined;
}

/**
 * The two saves of a document form, both through the form kit so the server's
 * messages, the draft and the clean state behave as in every form, and Ctrl+S
 * for the first. A form whose role may not save leaves Ctrl+S inert.
 */
export function useDocumentSave<T extends FieldValues, O, R>(
  form: UseFormReturn<T, unknown, O>,
  options: DocumentSaveOptions<O, R>,
): { save: () => Promise<void>; saveNew: () => Promise<void> } {
  const { onSave, onSaved, draft, serverPaths, blockedReason, allowClean } =
    options;
  const common = { draft, ...(serverPaths ? { serverPaths } : {}) };
  const save = useFormSave(form, {
    ...common,
    onSave: (values) => onSave(values, false),
    onSaved: (result) => onSaved?.(result, false),
  });
  const saveNew = useFormSave(form, {
    ...common,
    onSave: (values) => onSave(values, true),
    onSaved: (result) => onSaved?.(result, true),
  });
  useSaveShortcut(form, save, {
    ...(blockedReason ? { blockedReason } : {}),
    ...(allowClean ? { allowClean } : {}),
  });
  return { save, saveNew };
}
