import { useEffect, useRef } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { matchesShortcut, shortcut } from "@/app/shell/shortcutRegistry";
import { useSaveReason, type SaveOptions } from "./useSaveReason";

const OPEN_DIALOG =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';

function isSaveKey(event: KeyboardEvent): boolean {
  return !event.shiftKey && matchesShortcut(shortcut("save"), event);
}

/**
 * Leaves and re-enters the field being typed in, so that what its blur does,
 * such as tidying an amount, happens before the save reads the form. Without
 * this the shortcut would accept less than the Save button does.
 */
function commitActiveField(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active.matches("input, textarea")) {
    active.blur();
    active.focus();
  }
}

/**
 * Ctrl+S or Command+S saves a page's form, from any field. The browser's own
 * save-page dialog never opens, even when there is nothing to save. It stays
 * quiet while a dialog is over the page, such as the session-ended sign-in. Give
 * it the same `blockedReason` and `allowClean` as the `SaveButton`.
 */
export function useSaveShortcut<T extends FieldValues, O = T>(
  form: UseFormReturn<T, unknown, O>,
  save: () => void | Promise<void>,
  options: SaveOptions = {},
): void {
  const { ready } = useSaveReason(form, options);
  const latest = useRef({ save, ready: false });

  useEffect(() => {
    latest.current = { save, ready };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isSaveKey(event)) return;
      event.preventDefault();
      if (event.repeat || !latest.current.ready) return;
      if (document.querySelector(OPEN_DIALOG)) return;
      commitActiveField();
      void latest.current.save();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
