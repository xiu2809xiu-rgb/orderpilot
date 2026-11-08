import type { OrderCaptureState } from "@orderpilot/shared";
import type { StatusFamily } from "@/components/common";

/**
 * How each entry state is drawn, in the list and on the order's own page.
 * Submitted only says that entry is finished, so it takes the neutral chip (no
 * family): a green tick would read as approved, which it is not. Void is struck
 * through by the chip so that it never reads as finished work.
 */
export const CAPTURE_FAMILY: Record<
  OrderCaptureState,
  StatusFamily | undefined
> = {
  draft: "draft",
  submitted: undefined,
  void: "done",
};
