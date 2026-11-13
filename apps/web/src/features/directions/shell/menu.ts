import type { Session } from "@orderpilot/shared";
import { Palette } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MenuCount, ModuleId } from "@/features/define";
import { menuFor } from "@/features/nav";
import type { ScreenId } from "../screens";
import { isBuilt } from "../screens";

/** What people are doing, in the order the panel lists it. */
export const GROUP_IDS = ["work", "stock", "insights", "control"] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export interface PanelEntry {
  id: string;
  /** `namespace:key`, for `t()`. */
  label: string;
  icon: LucideIcon;
  /** The preview screen the entry opens. Without one it is a plain row. */
  screen?: ScreenId;
  count?: MenuCount;
  /** The real menu entries this row stands for. */
  sources: readonly string[];
}

export interface PanelGroup {
  id: GroupId;
  entries: PanelEntry[];
}

/** Today's "Orders" and "Order tracker" are one workspace in the preview. */
export const ORDERS_SOURCES: readonly string[] = [
  "orders.orders",
  "order-tracker.tracker",
];
const ORDERS_ID = "orders";

/** The kit sheet is a screen of the preview, not an entry of any role. */
export const KIT_ENTRY_ID = "preview.kit";

/** The entries that open one of the preview's own screens, once it is built. */
const SCREEN_OF: Readonly<Record<string, ScreenId>> = {
  home: "home",
  [ORDERS_ID]: "orders",
  "insights.kpis": "insights",
  [KIT_ENTRY_ID]: "kit",
};

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

interface Row {
  group: GroupId;
  entry: PanelEntry;
}

/**
 * The role's real menu, regrouped by what people are doing: work, stock and
 * buying, insights, control. Every entry the role has today is kept, once;
 * "Orders" and "Order tracker" become one row. A row opens a screen of the
 * preview only where that screen is built (`built`), otherwise it has no
 * address, so nothing in the panel leads nowhere.
 */
export function panelMenu(
  session: Session | null,
  built: (id: ScreenId) => boolean = isBuilt,
): PanelGroup[] {
  const rows: Row[] = [];
  for (const real of menuFor(session)) {
    const group = GROUP_OF_ENTRY[real.id] ?? GROUP_OF_MODULE[real.module];
    const merged = rows.find((row) => row.entry.id === ORDERS_ID);
    if (ORDERS_SOURCES.includes(real.id)) {
      if (merged) {
        merged.entry = {
          ...merged.entry,
          sources: [...merged.entry.sources, real.id],
          count: merged.entry.count ?? real.count,
        };
      } else {
        rows.push({
          group,
          entry: {
            id: ORDERS_ID,
            label: "directions:panel.orders",
            icon: real.icon,
            sources: [real.id],
            count: real.count,
          },
        });
      }
      continue;
    }
    rows.push({
      group,
      entry: {
        id: real.id,
        label: real.label,
        icon: real.icon,
        sources: [real.id],
        count: real.count,
      },
    });
  }
  rows.push({
    group: "control",
    entry: {
      id: KIT_ENTRY_ID,
      label: "directions:screens.kit.title",
      icon: Palette,
      sources: [KIT_ENTRY_ID],
    },
  });

  return GROUP_IDS.map((id) => ({
    id,
    entries: rows
      .filter((row) => row.group === id)
      .map((row) => withScreen(row.entry, built)),
  })).filter((group) => group.entries.length > 0);
}

function withScreen(
  entry: PanelEntry,
  built: (id: ScreenId) => boolean,
): PanelEntry {
  const screen = SCREEN_OF[entry.id];
  return screen !== undefined && built(screen) ? { ...entry, screen } : entry;
}
