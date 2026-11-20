import type { Session } from "@orderpilot/shared";
import type { TFunction } from "i18next";
import { Settings, type LucideIcon } from "lucide-react";
import { actionsFor, type AppAction } from "@/lib/actions";
import type { RecordTab } from "@/stores/recordTabs";
import { matchesQuery } from "./paletteMatch";
import { panelMenu } from "./panelMenu";

/** A page or an action: one line with an icon, and what happens on Enter. */
export interface PlainEntry {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords: readonly string[];
  /** A page opens this address. */
  to?: string;
  /** An action runs. */
  action?: AppAction;
}

/** The theme and sign-out sit at the end: they are the ones nobody searches for. */
const LAST = ["theme.light", "theme.dark", "session.signOut"];

/** The places of the side panel, in its order, then Settings. */
export function pageEntries(
  session: Session | null,
  t: TFunction,
): PlainEntry[] {
  const pages = panelMenu(session)
    .flatMap((group) => group.rows)
    .map(({ entry }): PlainEntry => ({
      id: entry.id,
      label: t(entry.label),
      icon: entry.icon,
      keywords: [],
      to: entry.to,
    }));
  return [
    ...pages,
    {
      id: "settings",
      label: t("nav.settings"),
      icon: Settings,
      keywords: [],
      to: "/settings",
    },
  ];
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * What the role may do. An action that only bears the name of a page is left
 * out, so "Customers" is listed once, under Go to.
 */
export function actionEntries(
  session: Session | null,
  t: TFunction,
  pages: readonly PlainEntry[],
): PlainEntry[] {
  const entries = actionsFor(session)
    .map((action): PlainEntry => ({
      id: action.id,
      label: t(action.label, {
        ns: action.namespace ?? "common",
        defaultValue: action.label,
      }),
      icon: action.icon,
      keywords: action.keywords ?? [],
      action,
    }))
    .filter((entry) => !pages.some((page) => same(page.label, entry.label)));
  const rank = (entry: PlainEntry) => LAST.indexOf(entry.id);
  // Array.sort is stable: the others keep the order they were registered in.
  return entries.sort((a, b) => rank(a) - rank(b));
}

/** The entries a typed query leaves. An empty query leaves them all. */
export const matching = (entries: readonly PlainEntry[], query: string) =>
  entries.filter((entry) =>
    matchesQuery(query, [entry.label, ...entry.keywords]),
  );

/** The most recent open records first: the strip appends, so the last is the newest. */
export const recentTabs = (tabs: readonly RecordTab[], limit = 5) =>
  tabs.slice(-limit).reverse();
