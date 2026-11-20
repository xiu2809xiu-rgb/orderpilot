import type { WorkflowTask } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { formatQuantity } from "@/lib/format";
import { RecordLinkText } from "./RecordLinkText";

/**
 * What tells two SPR rows apart once the title names the order: the SPR's own
 * number, as the link to it, and what is short ("707 short: Samsung SSD 1 TB
 * NVMe"). Only what the task carries: the row asks for nothing more. Nothing
 * at all when the task carries neither.
 */
export function SprDetail({
  task,
  showRef,
}: {
  task: WorkflowTask;
  /** False when the row's title already is the link to the SPR. */
  showRef: boolean;
}) {
  const { t } = useTranslation("directions-home");
  const { ref, spr } = task;
  if ((!ref || !showRef) && !spr) return null;
  return (
    <>
      {ref && showRef ? (
        <RecordLinkText
          to={`/workflows/sprs/${encodeURIComponent(ref.recordNo)}`}
        >
          {ref.recordNo}
        </RecordLinkText>
      ) : null}
      {spr ? (
        <span className="min-w-0">
          {t("needs.sprShort", {
            quantity: formatQuantity(spr.quantity),
            item: spr.itemDescription,
          })}
        </span>
      ) : null}
    </>
  );
}
