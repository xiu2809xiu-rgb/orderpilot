import { useTranslation } from "react-i18next";
import type { OrderCaptureState } from "@orderpilot/shared";
import { StatusChip } from "@/components/common";
import { CAPTURE_FAMILY } from "./captureFamily";

/** How far the entry of a stored order has got. A sample has none, so it shows nothing. */
export function CaptureChip({ state }: { state: OrderCaptureState | null }) {
  const { t } = useTranslation("orders");
  if (!state) return null;
  return (
    <StatusChip
      family={CAPTURE_FAMILY[state]}
      className={state === "void" ? "line-through" : undefined}
    >
      {t(`captureStates.${state}`)}
    </StatusChip>
  );
}
