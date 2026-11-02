import { useRef } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import {
  applyServerError,
  showInvalidOnForm,
  type PathMap,
} from "./serverErrors";
import type { DraftControl } from "./useDraft";
import { isSameViewer, useMountViewer } from "./useViewerChanged";

interface FormSaveOptions<O, R> {
  /** Sends the checked values. A throw lands on the form through `applyServerError`. */
  onSave: (values: O) => Promise<R>;
  /** Runs after the form is clean, so it can navigate without being asked. */
  onSaved?: (result: R) => void | Promise<void>;
  draft?: DraftControl;
  /**
   * The server's field paths where the form calls them something else, such as
   * { customerNo: "customer", "lines.*.itemNo": "lines.*.item" }.
   */
  serverPaths?: PathMap;
}

/**
 * The one way a form saves. Valid values go to `onSave`. On success the draft
 * goes and the saved values become the form's clean state, so leaving no longer
 * asks. On failure the errors land on the form and the draft stays.
 */
export function useFormSave<T extends FieldValues, O = T, R = unknown>(
  form: UseFormReturn<T, unknown, O>,
  { onSave, onSaved, draft, serverPaths }: FormSaveOptions<O, R>,
): () => Promise<void> {
  const mountViewer = useMountViewer();
  // What the person had when they pressed Save. Fields stay editable during a
  // save, and whatever is typed meanwhile was never sent.
  const sent = useRef<T | null>(null);
  const submit = form.handleSubmit(
    async (values) => {
      // Someone else signed in over this form: these are not their values to send.
      if (!isSameViewer(mountViewer)) return;
      let result: R;
      try {
        result = await onSave(values);
      } catch (error) {
        applyServerError(error, form, serverPaths);
        return;
      }
      // The sent values become the clean state; later typing stays unsaved.
      const saved = sent.current ?? form.getValues();
      const typedSince =
        JSON.stringify(form.getValues()) !== JSON.stringify(saved);
      form.reset(saved, { keepValues: true, keepDirty: typedSince });
      draft?.settle(saved);
      await onSaved?.(result);
    },
    (errors) => {
      showInvalidOnForm(errors, form);
    },
  );
  return () => {
    sent.current = structuredClone(form.getValues());
    return submit();
  };
}
