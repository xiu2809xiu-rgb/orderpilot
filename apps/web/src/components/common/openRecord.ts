import i18n from "i18next";
import { resolveRecord } from "@/lib/resolveRecord";
import {
  hasNews,
  useRecordTabs,
  type OpenResult,
  type RecordTab,
} from "@/stores/recordTabs";
import { useSessionStore } from "@/stores/session";
import type { OpenGesture } from "./useOpenRecord";
import { toast } from "./toast";

const NAMESPACE = "record-tabs";

/** Says what opening a record did out of sight. Plain opens that just worked are silent. */
export async function announce(
  result: OpenResult,
  background: boolean,
): Promise<void> {
  await i18n.loadNamespaces(NAMESPACE);
  const t = i18n.getFixedT("en", NAMESPACE);
  const nameOf = (tab: RecordTab) =>
    t("name", { kind: t(`kinds.${tab.kind}`), no: tab.no });

  if (result.outcome === "full") {
    toast.failed(t("full"), { description: t("fullHint") });
    return;
  }
  const madeRoom =
    result.outcome === "replaced"
      ? t("madeRoom", { name: nameOf(result.closed) })
      : undefined;
  if (!background) {
    if (madeRoom) toast.done(madeRoom);
    return;
  }
  const name = nameOf(result.tab);
  toast.done(
    result.outcome === "existing"
      ? t("alreadyOpen", { name })
      : t("openedInBackground", { name }),
    madeRoom ? { description: madeRoom } : {},
  );
}

/**
 * Adds the record's tab for a click. Answers "go" when the caller should
 * navigate to it and "stay" when it should not: a background open, or no room
 * because every tab has unsaved changes.
 */
export function openRecord(
  to: string,
  gesture: OpenGesture,
  fromPath: string,
): "go" | "stay" {
  const record = resolveRecord(to);
  if (!record) return "go";
  const background = gesture === "background";
  const tabs = useRecordTabs.getState();
  // The strip loads this viewer's tabs once it mounts; a click can beat it.
  tabs.load(useSessionStore.getState().session?.user.id ?? null);
  const result = tabs.open(
    record,
    to,
    background ? resolveRecord(fromPath)?.key : undefined,
  );
  if (hasNews(result, background)) void announce(result, background);
  return background || result.outcome === "full" ? "stay" : "go";
}
