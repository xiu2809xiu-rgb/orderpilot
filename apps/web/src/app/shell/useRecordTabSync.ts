import { useEffect, useMemo, useRef } from "react";
import { useLocation, useMatches } from "react-router";
import { onStay } from "./roleSwitch";
import type { RecordRef } from "@/lib/records";
import { recordFromMatches } from "@/lib/resolveRecord";
import { announce } from "@/components/common/openRecord";
import { hasNews, useRecordTabs } from "@/stores/recordTabs";
import { useSessionStore } from "@/stores/session";

/**
 * Keeps the strip in step with the page: it shows the signed-in viewer's
 * tabs, and a record page that is not yet a tab becomes one. A record link has
 * usually added the tab already; this covers a typed address, Back and a
 * reload. Returns the record on screen, if any.
 *
 * A change of role signs another person in while the old page is still on
 * screen, and that page is not theirs to keep: unless the change deliberately
 * stays on it (`announceStay`), which makes it theirs, as if they had opened it.
 */
export function useRecordTabSync(): RecordRef | null {
  const viewerId = useSessionStore((state) => state.session?.user.id ?? null);
  const matches = useMatches();
  const { search, pathname } = useLocation();
  const record = useMemo(() => recordFromMatches(matches), [matches]);
  const lastViewer = useRef<string | null>(null);
  const onScreen = useRef({ record, search, pathname });
  onScreen.current = { record, search, pathname };

  // Runs before the effect below, so a new viewer's tabs load before one is added.
  useEffect(() => {
    useRecordTabs.getState().load(viewerId);
  }, [viewerId]);

  // Plain values, so only a new record, a new query or a new viewer is a new visit.
  const key = record?.key;
  const kind = record?.kind;
  const no = record?.no;
  const listPath = record?.listPath;
  useEffect(() => {
    // A role switch signs another person in while the old page is still on
    // screen: that page is not theirs to keep as a tab.
    const switched =
      lastViewer.current !== null && lastViewer.current !== viewerId;
    lastViewer.current = viewerId;
    if (switched || !key || !kind || !no || !listPath || !viewerId) return;
    const result = useRecordTabs
      .getState()
      .open({ key, kind, no, listPath }, `${key}${search}`, key);
    if (hasNews(result, false)) {
      void announce(result, false);
    }
  }, [key, kind, no, listPath, search, viewerId]);

  // A change of role that stays on this very page: the new viewer is on a
  // record's page, so it is a tab in their strip like any page they opened.
  useEffect(
    () =>
      onStay((stayed) => {
        const {
          record: shown,
          search: query,
          pathname: path,
        } = onScreen.current;
        const viewer = useSessionStore.getState().session?.user.id ?? null;
        if (!shown || !viewer || stayed !== path) return;
        // The strip may not have loaded the new viewer's tabs yet.
        useRecordTabs.getState().load(viewer);
        const result = useRecordTabs.getState().open(
          {
            key: shown.key,
            kind: shown.kind,
            no: shown.no,
            listPath: shown.listPath,
          },
          `${shown.key}${query}`,
          shown.key,
        );
        if (hasNews(result, false)) void announce(result, false);
      }),
    [],
  );

  return record;
}
