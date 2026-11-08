import { useTranslation } from "react-i18next";
import type { OrderCaptureState } from "@orderpilot/shared";
import { StatusChip, type StatusFamily } from "@/components/common";

// Submitted only says that entry is finished: it must never look like approval.
const FAMILY: Record<OrderCaptureState, StatusFamily> = {
  draft: "draft",
  submitted: "ready",
  void: "done",
};

/** How far the entry of a stored order has got. A sample has none, so it shows nothing. */
export function CaptureChip({ state }: { state: OrderCaptureState | null }) {
  const { t } = useTranslation("orders");
  if (!state) return null;
  return (
    <StatusChip family={FAMILY[state]}>
      {t(`captureStates.${state}`)}
    </StatusChip>
  );
}
