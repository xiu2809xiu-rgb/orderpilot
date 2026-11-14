import type { Session } from "@orderpilot/shared";
import type { MenuEntry, ModuleId } from "@/features/define";
import { isEntryActive, menuFor } from "@/features/nav";

/** What people are doing, in the order the panel lists it. */
export const GROUP_IDS = ["work", "stock", "insights", "control"] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export interface PanelRow {
  /** The menu entry the row opens. */
  entry: MenuEntry;
  /** Every entry whose page keeps this row the current one: its own, and any it stands for. */
  covers: readonly MenuEntry[];
}

export interface PanelGroup {
  id: GroupId;
  rows: PanelRow[];
}

/** The Orders page holds what the order tracker lists, so the panel has one row for both. */
export const ORDERS_ENTRY_ID = "orders.orders";
export const TRACKER_ENTRY_ID = "order-tracker.tracker";

const GROUP_OF_MODULE: Readonly<Record<ModuleId, GroupId>> = {
  home: "work",
  sales: "work",
  purchasing: "work",
  warehouse: "work",
  finance: "work",
  documents: "work",
  masterData: "stock",
  reports: "insights",
  system: "control",
};

/** Exceptions are what the checks find: people work them, so they sit with the orders. */
const GROUP_OF_ENTRY: Readonly<Record<string, GroupId>> = {
  "exceptions.exceptions": "work",
};

function groupOf(entry: MenuEntry): GroupId {
  return GROUP_OF_ENTRY[entry.id] ?? GROUP_OF_MODULE[entry.module];
}

/**
 * The role's menu, regrouped by what people are doing: work, stock and buying,
 * insights, control. Every entry the role has is kept, once. A role that has
 * both Orders and the order tracker gets one Orders row, which stays current
 * on the tracker's pages too; a role with only the tracker keeps its row.
 */
export function panelMenu(session: Session | null): PanelGroup[] {
  const menu = menuFor(session);
  const orders = menu.find((entry) => entry.id === ORDERS_ENTRY_ID);
  const tracker = menu.find((entry) => entry.id === TRACKER_ENTRY_ID);
  const merged = orders !== undefined && tracker !== undefined;

  const rows: PanelRow[] = [];
  for (const entry of menu) {
    if (merged && entry.id === TRACKER_ENTRY_ID) continue;
    if (merged && entry.id === ORDERS_ENTRY_ID) {
      rows.push({
        // The tracker's count of work waiting moves to the one row.
        entry: { ...entry, count: entry.count ?? tracker.count },
        covers: [entry, tracker],
      });
      continue;
    }
    rows.push({ entry, covers: [entry] });
  }

  return GROUP_IDS.map((id) => ({
    id,
    rows: rows.filter((row) => groupOf(row.entry) === id),
  })).filter((group) => group.rows.length > 0);
}

/** Whether a row is where the person is. */
export function isRowCurrent(
  row: PanelRow,
  where: { pathname: string; search: string },
): boolean {
  return row.covers.some((entry) => isEntryActive(entry, where));
}

/** The group of the row the person is on, for the first crumb of the trail. */
export function currentGroup(
  groups: readonly PanelGroup[],
  where: { pathname: string; search: string },
): GroupId | undefined {
  return groups.find((group) =>
    group.rows.some((row) => isRowCurrent(row, where)),
  )?.id;
}
