import type { OrderCaptureState } from "@orderpilot/shared";
import { Ban, FileCheck, FilePen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/kit/Badge";
import { StatusChip } from "@/components/kit/StatusChip";

/**
 * How far the entry of a stored order has got. Only a draft is a status to act
 * on, so it takes the info colour. Submitted says that entry is finished and
 * nothing more, so it is neutral: a green tick would read as approved. Void is
 * struck through, so it never reads as finished work.
 */
export function EntryChip({ state }: { state: OrderCaptureState }) {
  const { t } = useTranslation("directions-orders");
  if (state === "draft") {
    return (
      <StatusChip kind="info" icon={FilePen}>
        {t("entry.draft")}
      </StatusChip>
    );
  }
  const Icon = state === "void" ? Ban : FileCheck;
  return (
    <Badge
      variant="outline"
      radius="full"
      data-entry={state}
      className={state === "void" ? "line-through" : undefined}
    >
      <Icon aria-hidden="true" />
      {t(`entry.${state}`)}
    </Badge>
  );
}
