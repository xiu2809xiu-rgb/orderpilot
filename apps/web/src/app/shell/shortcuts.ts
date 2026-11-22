import { useEffect } from "react";
import { runPrimaryAction } from "@/components/common/primaryAction";
import { matchesShortcut, shortcut } from "./shortcutRegistry";

const TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "range",
  "file",
  "color",
  "image",
]);

/** True while the person is typing, so a letter key is a letter and not a shortcut. */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return !TEXT_INPUT_TYPES.has(target.type);
  }
  const role = target.getAttribute("role");
  // A listbox, menu or select trigger takes letters for type-ahead.
  return role === "textbox" || role === "combobox";
}

/** A dialog, sheet, menu, list or the palette is open: the page behind it is not in play. */
export function dialogIsOpen(root: ParentNode = document): boolean {
  return (
    root.querySelector(
      '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="menu"], [role="listbox"]',
    ) !== null
  );
}

/** The page's quick search, if it has one that is on screen. */
export function focusQuickSearch(root: ParentNode = document): boolean {
  const field = root.querySelector<HTMLInputElement>("[data-quick-search]");
  if (!field || field.disabled) return false;
  field.focus();
  field.select();
  return true;
}

/**
 * Slash focuses the page's quick search; N runs the page's primary action.
 * Neither fires with a modifier held, while typing in a field, or while a
 * dialog is open. A page with no search or no primary action ignores the key.
 */
export function useGlobalShortcuts() {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target) || dialogIsOpen()) return;
      if (matchesShortcut(shortcut("search"), event)) {
        if (focusQuickSearch()) event.preventDefault();
      } else if (matchesShortcut(shortcut("new"), event)) {
        if (runPrimaryAction()) event.preventDefault();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
