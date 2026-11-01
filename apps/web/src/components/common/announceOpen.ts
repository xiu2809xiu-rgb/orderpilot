import i18n from "i18next";
import type { OpenResult, RecordTab } from "@/stores/recordTabs";
import { toast } from "./toast";

const NAMESPACE = "record-tabs";

/**
 * Says what opening a record did out of sight: a background tab appeared, the
 * oldest tab made room, or nothing could open. It loads on first use, with its
 * words, so a person who never opens a record does not download either.
 */
export async function announceOpen(
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
