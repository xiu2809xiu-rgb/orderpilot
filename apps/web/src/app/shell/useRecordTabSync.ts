import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useMatches } from "react-router";
import { toast } from "@/components/common";
import { recordFromMatches, type RecordRef } from "@/lib/records";
import { useRecordTabs } from "@/stores/recordTabs";
import { useSessionStore } from "@/stores/session";

/**
 * Keeps the strip in step with the page: it shows the signed-in viewer's
 * tabs, and a record page that is not yet a tab becomes one. A record link has
 * usually added the tab already; this covers a typed address, Back and a
 * reload. Returns the record on screen, if any.
 */
export function useRecordTabSync(): RecordRef | null {
  const { t } = useTranslation();
  const viewerId = useSessionStore((state) => state.session?.user.id ?? null);
  const matches = useMatches();
  const { search } = useLocation();
  const record = useMemo(() => recordFromMatches(matches), [matches]);
  const lastViewer = useRef<string | null>(null);

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
    if (result.outcome === "full") {
      toast.failed(t("recordTabs.full"), {
        description: t("recordTabs.fullHint"),
      });
    } else if (result.outcome === "replaced") {
      const { closed } = result;
      toast.done(
        t("recordTabs.madeRoom", {
          name: t("recordTabs.name", {
            kind: t(`recordTabs.kinds.${closed.kind}`),
            no: closed.no,
          }),
        }),
      );
    }
  }, [key, kind, no, listPath, search, viewerId, t]);

  return record;
}
