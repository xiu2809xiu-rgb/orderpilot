import type { TFunction } from "i18next";
import type { DocumentTabsSpec } from "@/components/document-form";
import type { DocStatus } from "./documentDemo";

const STEPS = ["created", "submitted", "approved"] as const;

/**
 * The tabs under the gallery document: a timeline and one failed check, no
 * documents. A fresh order from Save and new has none of them yet, so each tab
 * shows its compact empty state.
 */
export function galleryDocumentTabs(
  t: TFunction<"gallery">,
  status: DocStatus,
  number: string,
  fresh = false,
): DocumentTabsSpec {
  const reached = status === "draft" ? 1 : status === "waiting" ? 2 : 3;
  return {
    timeline: {
      count: !fresh && status === "waiting" ? 1 : 0,
      content: fresh ? null : (
        <ol className="space-y-1 text-sm">
          {STEPS.slice(0, reached).map((step) => (
            <li key={step}>{t(`document.timeline.${step}`)}</li>
          ))}
        </ol>
      ),
    },
    checks: fresh
      ? { count: 0, content: null }
      : {
          count: 1,
          content: <p className="text-sm">{t("document.checkFailed")}</p>,
        },
    documents: { count: 0, content: null },
    log: { entityType: "Order", entityId: number },
  };
}
