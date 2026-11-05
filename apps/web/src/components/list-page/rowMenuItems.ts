import type { Permission, Session } from "@orderpilot/shared";
import type { LucideIcon } from "lucide-react";
import { hasPermission } from "@/stores/session";

/** What a row menu item is told about the row it was opened on. */
export interface RowMenuTarget {
  /** The list it was opened from, as its `tableId` names it. */
  listId: string;
  /** The row's name, such as "SO-10001". */
  label: string;
  /** The record page the row opens, when it has one. */
  href: string | undefined;
}

/**
 * An item that every row menu offers, whatever the list. My work's Pin to
 * top, Remind me and Add to my to-dos are these (P-57): registered once, from
 * one place, they appear in every list's row menu between Edit and Copy.
 */
export interface RowMenuItem {
  id: string;
  /** A key of the `common` namespace, which every page has loaded. */
  label: string;
  icon: LucideIcon;
  /** The role must hold it, or the item is not offered. */
  permission?: Permission;
  /** Offered only on a row that opens a record page. */
  needsRecord?: boolean;
  run: (target: RowMenuTarget) => void;
}

const items = new Map<string, RowMenuItem>();

/** Adds an item to every row menu. Returns a function that takes it out again. */
export function registerRowMenuItem(item: RowMenuItem): () => void {
  items.set(item.id, item);
  return () => {
    if (items.get(item.id) === item) items.delete(item.id);
  };
}

/** The shared items this session may use on this row, in the order they were registered. */
export function rowMenuItemsFor(
  session: Session | null,
  target: RowMenuTarget,
): RowMenuItem[] {
  return [...items.values()].filter(
    (item) =>
      (item.permission === undefined ||
        hasPermission(session, item.permission)) &&
      (!item.needsRecord || target.href !== undefined),
  );
}

/** True when some item is registered, so even a list with no row actions needs its menu. */
export function hasRowMenuItems(): boolean {
  return items.size > 0;
}
