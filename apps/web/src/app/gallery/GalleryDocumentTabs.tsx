import type { TFunction } from "i18next";
import type { DocumentTabsSpec } from "@/components/document-form";
import { DOC_NUMBER, type DocStatus } from "./documentDemo";

const STEPS = ["created", "submitted", "approved"] as const;

/** The tabs under the gallery document: a timeline and one failed check, no documents. */
export function galleryDocumentTabs(
  t: TFunction<"gallery">,
  status: DocStatus,
): DocumentTabsSpec {
  const reached = status === "draft" ? 1 : status === "waiting" ? 2 : 3;
  return {
    timeline: {
      count: status === "waiting" ? 1 : 0,
      content: (
        <ol className="space-y-1 text-sm">
          {STEPS.slice(0, reached).map((step) => (
            <li key={step}>{t(`document.timeline.${step}`)}</li>
          ))}
        </ol>
      ),
    },
    checks: {
      count: 1,
      content: <p className="text-sm">{t("document.checkFailed")}</p>,
    },
    documents: { count: 0, content: null },
    log: { entityType: "Order", entityId: DOC_NUMBER },
  };
}
