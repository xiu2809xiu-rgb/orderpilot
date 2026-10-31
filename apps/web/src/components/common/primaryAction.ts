import type { LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { create } from "zustand";

/** What a list's main button does: "Upload PO", "New order", "Raise SPR". */
export interface PrimaryAction {
  /** Already translated, in the user's words. */
  label: string;
  icon?: LucideIcon;
  /** Opens the dialog or goes to the form. Runs on a click and on the N key. */
  onRun: () => void;
  disabled?: boolean;
}

interface Entry {
  token: symbol;
  label: string;
  icon?: LucideIcon;
  disabled: boolean;
  run: () => void;
}

interface PrimaryActionState {
  current: Entry | null;
}

export const usePrimaryActionStore = create<PrimaryActionState>()(() => ({
  current: null,
}));

/**
 * Declares the page's primary action while the page is on screen. PageHeader
 * does this for you when you pass `primaryAction`; call the hook yourself only
 * when the button lives elsewhere. A page with no record to start passes
 * nothing, and the N key does nothing there.
 */
export function usePrimaryAction(action: PrimaryAction | null | undefined) {
  const latest = useRef(action);
  useEffect(() => {
    latest.current = action;
  });
  const label = action?.label;
  const icon = action?.icon;
  const disabled = action?.disabled ?? false;
  useEffect(() => {
    if (label === undefined) return;
    const token = Symbol("primary-action");
    usePrimaryActionStore.setState({
      current: {
        token,
        label,
        icon,
        disabled,
        run: () => {
          latest.current?.onRun();
        },
      },
    });
    return () => {
      if (usePrimaryActionStore.getState().current?.token === token) {
        usePrimaryActionStore.setState({ current: null });
      }
    };
  }, [label, icon, disabled]);
}

/** Runs the page's primary action. False when there is none or it is off. */
export function runPrimaryAction(): boolean {
  const entry = usePrimaryActionStore.getState().current;
  if (!entry || entry.disabled) return false;
  entry.run();
  return true;
}
