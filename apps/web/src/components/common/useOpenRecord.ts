import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { resolveRecord } from "@/lib/records";
import { useRecordTabs, type OpenResult } from "@/stores/recordTabs";
import { toast } from "./toast";

/** How a person asked to open something. */
export type OpenGesture = "plain" | "background" | "browser";

interface PointerLike {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Ctrl+click, Command+click and a middle click open a record in a background
 * tab of our strip. Shift and Alt keep their browser meaning (a new window, a
 * download), and so does any other button.
 */
export function gestureOf(event: PointerLike): OpenGesture {
  if (event.button === 1) return "background";
  if (event.button !== 0) return "browser";
  if (event.ctrlKey || event.metaKey) return "background";
  if (event.shiftKey || event.altKey) return "browser";
  return "plain";
}

/**
 * What the caller does next: `go` navigates (a link lets the router do it),
 * `stay` stops here, and `default` leaves the click to the browser because the
 * address is not a record page.
 */
export type OpenNext = "go" | "stay" | "default";

/** Opens a record's tab for a click, and says so when something changed out of sight. */
export function useOpenRecord(): (
  to: string,
  gesture: OpenGesture,
) => OpenNext {
  const { t } = useTranslation();
  // Not useMatches: a link also renders under a plain MemoryRouter in tests.
  const { pathname } = useLocation();
  const onScreen = useMemo(() => resolveRecord(pathname)?.key, [pathname]);

  return useCallback(
    (to, gesture) => {
      if (gesture === "browser") return "default";
      const record = resolveRecord(to);
      if (!record) return "default";
      const name = t("recordTabs.name", {
        kind: t(`recordTabs.kinds.${record.kind}`),
        no: record.no,
      });
      const background = gesture === "background";
      const result: OpenResult = useRecordTabs
        .getState()
        .open(record, to, background ? onScreen : undefined);

      if (result.outcome === "full") {
        toast.failed(t("recordTabs.full"), {
          description: t("recordTabs.fullHint"),
        });
        return "stay";
      }
      const madeRoom =
        result.outcome === "replaced"
          ? t("recordTabs.madeRoom", {
              name: t("recordTabs.name", {
                kind: t(`recordTabs.kinds.${result.closed.kind}`),
                no: result.closed.no,
              }),
            })
          : undefined;
      if (background) {
        toast.done(
          result.outcome === "existing"
            ? t("recordTabs.alreadyOpen", { name })
            : t("recordTabs.openedInBackground", { name }),
          madeRoom ? { description: madeRoom } : {},
        );
        return "stay";
      }
      if (madeRoom) toast.done(madeRoom);
      return "go";
    },
    [t, onScreen],
  );
}
