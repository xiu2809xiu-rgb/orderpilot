import { create } from "zustand";

export type ToastKind = "done" | "error";

/** A link beside Undo, such as "Open order". Its words are the caller's, already translated. */
export interface ToastAction {
  label: string;
  /** An address inside the app. */
  to: string;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  description?: string;
  /** Reverses the action. When present the toast shows an Undo button. */
  undo?: () => void | Promise<void>;
  /** When present the toast shows a link to the record the message is about. */
  action?: ToastAction;
}

export interface ToastOptions {
  /** One short line of detail, such as the reference of the record. */
  description?: string;
  /** Pass a function that reverses the action and the toast offers Undo. */
  undo?: () => void | Promise<void>;
  /** Pass a label and an address and the toast offers a link there. */
  action?: ToastAction;
}

interface ToastState {
  items: ToastItem[];
  push: (item: Omit<ToastItem, "id">) => number;
  dismiss: (id: number) => void;
}

const MAX_VISIBLE = 3;
let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  items: [],
  push: (item) => {
    const id = nextId++;
    set((state) => ({
      items: [...state.items, { ...item, id }].slice(-MAX_VISIBLE),
    }));
    return id;
  },
  dismiss: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
}));

/**
 * The one way an action tells the person it is done. Every action ends with a
 * toast: `toast.done("Approved SPR-1042", { undo })` when it worked, and
 * `toast.failed("Could not approve")` when it did not. Pass `undo` only where
 * the action can really be reversed. Words are the caller's, already
 * translated. The Toaster in the app shell shows it and announces it to
 * screen readers; a toast never takes focus.
 */
export const toast = {
  done: (message: string, options: ToastOptions = {}) =>
    useToastStore.getState().push({ kind: "done", message, ...options }),
  failed: (message: string, options: Omit<ToastOptions, "undo"> = {}) =>
    useToastStore.getState().push({ kind: "error", message, ...options }),
  dismiss: (id: number) => {
    useToastStore.getState().dismiss(id);
  },
};
