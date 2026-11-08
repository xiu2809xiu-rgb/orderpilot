import { Ban, Check, Printer, Save, Send, SaveAll, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Session } from "@orderpilot/shared";
import { hasPermission } from "@/stores/session";
import {
  DOCUMENT_ACTION_KINDS,
  type DocumentAction,
  type DocumentActionKind,
} from "./types";

export const KIND_ICONS: Record<DocumentActionKind, LucideIcon> = {
  save: Save,
  saveNew: SaveAll,
  submit: Send,
  approve: Check,
  reject: X,
  print: Printer,
  void: Ban,
};

/**
 * The actions this form declares and this role may use, in the bar's order.
 * An action the role lacks the permission for is not here at all, so nothing
 * is drawn for it. The server refuses it anyway.
 */
export function usableActions(
  actions: readonly DocumentAction[],
  session: Session | null,
): DocumentAction[] {
  return actions
    .filter((action) => hasPermission(session, action.permission))
    .toSorted(
      (a, b) =>
        DOCUMENT_ACTION_KINDS.indexOf(a.kind) -
        DOCUMENT_ACTION_KINDS.indexOf(b.kind),
    );
}

/** Actions that act on what is saved, so unsaved changes must be saved first. */
export const NEEDS_SAVED: readonly DocumentActionKind[] = [
  "submit",
  "approve",
  "reject",
  "void",
];

const warned = new Set<string>();

/**
 * Development only: two actions of one kind would both be drawn and both run
 * the same save, so the form is wrong. Warns once per form and kind.
 */
export function warnDuplicateKinds(
  formId: string,
  actions: readonly DocumentAction[],
): void {
  const seen = new Set<DocumentActionKind>();
  for (const { kind } of actions) {
    const key = `${formId}:${kind}`;
    if (seen.has(kind) && !warned.has(key)) {
      warned.add(key);
      console.warn(
        `The "${formId}" document form declares two "${kind}" actions. Declare each kind once.`,
      );
    }
    seen.add(kind);
  }
}
