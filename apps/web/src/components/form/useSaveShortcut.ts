import { useEffect, useRef } from "react";
import {
  useFormState,
  type FieldValues,
  type UseFormReturn,
} from "react-hook-form";

const OPEN_DIALOG =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

function isSaveKey(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "s"
  );
}

/**
 * Ctrl+S or Command+S saves a page's form, from any field. The browser's own
 * save-page dialog never opens, even when there is nothing to save. It stays
 * quiet while a dialog is over the page, such as the session-ended sign-in.
 */
export function useSaveShortcut<T extends FieldValues, O = T>(
  form: UseFormReturn<T, unknown, O>,
  save: () => void | Promise<void>,
  { blocked = false }: { blocked?: boolean } = {},
): void {
  const { isDirty, isSubmitting } = useFormState({ control: form.control });
  const latest = useRef({ save, ready: false });

  useEffect(() => {
    latest.current = { save, ready: isDirty && !isSubmitting && !blocked };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSaveKey(event)) return;
      event.preventDefault();
      if (event.repeat || !latest.current.ready) return;
      if (document.querySelector(OPEN_DIALOG)) return;
      void latest.current.save();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
