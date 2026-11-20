import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { featureNamespaces } from "@/features/nav";
import { useRecordTabs, type RecordTab } from "@/stores/recordTabs";
import { useSessionStore } from "@/stores/session";
import {
  actionEntries,
  matching,
  pageEntries,
  recentTabs,
  type PlainEntry,
} from "./paletteEntries";
import { trimQuery } from "./paletteMatch";
import {
  MIN_QUERY_LENGTH,
  SEARCH_KINDS,
  type RecordHit,
} from "./paletteRecords";
import { usePaletteRecords } from "./paletteSearch";

export type PaletteRow =
  | { type: "plain"; entry: PlainEntry }
  | { type: "record"; hit: RecordHit }
  | { type: "recent"; tab: RecordTab };

export interface PaletteSection {
  id: string;
  heading: string;
  rows: PaletteRow[];
}

export const NAMESPACES = [
  "common",
  "components",
  "record-tabs",
  ...featureNamespaces,
];

/**
 * What the palette lists for what is typed. With nothing typed: the records
 * opened lately, the pages, the actions. Typed: the records found, then the
 * pages and actions that match.
 */
export function usePaletteModel(raw: string) {
  const { t } = useTranslation(NAMESPACES);
  const session = useSessionStore((state) => state.session);
  const tabs = useRecordTabs((state) => state.tabs);
  const query = trimQuery(raw);
  const records = usePaletteRecords(query);

  const pages = useMemo(() => pageEntries(session, t), [session, t]);
  const actions = useMemo(
    () => actionEntries(session, t, pages),
    [session, t, pages],
  );

  const sections = useMemo<PaletteSection[]>(() => {
    const plain = (entries: PlainEntry[]): PaletteRow[] =>
      entries.map((entry) => ({ type: "plain", entry }));
    const tail = (id: string, heading: string, entries: PlainEntry[]) =>
      entries.length ? [{ id, heading, rows: plain(entries) }] : [];

    if (!query) {
      const recent = recentTabs(tabs);
      return [
        ...(recent.length
          ? [
              {
                id: "recent",
                heading: t("palette.recent"),
                rows: recent.map((tab): PaletteRow => ({
                  type: "recent",
                  tab,
                })),
              },
            ]
          : []),
        ...tail("pages", t("palette.goTo"), pages),
        ...tail("actions", t("palette.actions"), actions),
      ];
    }
    return [
      ...SEARCH_KINDS.flatMap((kind) =>
        records.hits[kind].length
          ? [
              {
                id: kind,
                heading: t(`palette.groups.${kind}`),
                rows: records.hits[kind].map((hit): PaletteRow => ({
                  type: "record",
                  hit,
                })),
              },
            ]
          : [],
      ),
      ...tail("pages", t("palette.goTo"), matching(pages, query)),
      ...tail("actions", t("palette.actions"), matching(actions, query)),
    ];
  }, [query, tabs, pages, actions, records.hits, t]);

  const count = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const lookedUp = query.length >= MIN_QUERY_LENGTH;
  return { query, sections, count, lookedUp, records };
}
