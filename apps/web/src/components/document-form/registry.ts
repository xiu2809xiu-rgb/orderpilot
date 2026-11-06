import type { Permission, Session } from "@orderpilot/shared";
import type { LucideIcon } from "lucide-react";
import { hasPermission } from "@/stores/session";
import type { DocumentTarget } from "./types";

/**
 * An action every document form offers, whatever the document. My work's Pin
 * to top, Remind me and Add to my to-dos are these (P-57): registered once,
 * from one place, they appear in every form's More menu. The same shape as a
 * row menu item, so one registration can serve a list and a form.
 */
export interface DocumentFormItem {
  id: string;
  /** A key of the `common` namespace, which every page has loaded. */
  label: string;
  icon: LucideIcon;
  /** The role must hold it, or the item is not offered. */
  permission?: Permission;
  run: (target: DocumentTarget) => void;
}

const items = new Map<string, DocumentFormItem>();

/** Adds an item to every document form. Returns a function that takes it out again. */
export function registerDocumentFormItem(item: DocumentFormItem): () => void {
  items.set(item.id, item);
  return () => {
    if (items.get(item.id) === item) items.delete(item.id);
  };
}

/** The shared items this session may use, in the order they were registered. */
export function documentFormItemsFor(
  session: Session | null,
): DocumentFormItem[] {
  return [...items.values()].filter(
    (item) =>
      item.permission === undefined || hasPermission(session, item.permission),
  );
}
