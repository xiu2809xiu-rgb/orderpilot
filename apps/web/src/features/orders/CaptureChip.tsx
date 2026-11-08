import { useTranslation } from "react-i18next";
import type { OrderCaptureState } from "@orderpilot/shared";
import { StatusChip, type StatusFamily } from "@/components/common";

// Submitted only says that entry is finished, so it takes the neutral chip (no
// family): a green tick would read as approved, which it is not. Void is struck
// through so that it never reads as finished work.
const FAMILY: Record<OrderCaptureState, StatusFamily | undefined> = {
  draft: "draft",
  submitted: undefined,
  void: "done",
};

/** How far the entry of a stored order has got. A sample has none, so it shows nothing. */
export function CaptureChip({ state }: { state: OrderCaptureState | null }) {
  const { t } = useTranslation("orders");
  if (!state) return null;
  return (
    <StatusChip
      family={FAMILY[state]}
      className={state === "void" ? "line-through" : undefined}
    >
      {t(`captureStates.${state}`)}
    </StatusChip>
  );
}
