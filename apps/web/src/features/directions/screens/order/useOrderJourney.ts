import { useMemo } from "react";
import { todayInSingapore } from "@/lib/format";
import {
  useTrackerFlow,
  useTrackerTimeline,
} from "@/lib/api/generated/endpoints/tracker/tracker";
import { STEP_TIMES } from "../../data/index";
import { stepOfStatus } from "../orders/orderRow";
import { buildJourney } from "./journeyModel";

/**
 * An order's timeline from the tracker, the flow that says which step its
 * status is, and the journey worked out from both and the measured step
 * times. Nothing is read twice: the Orders list asks for the same flow, so
 * TanStack Query answers it from memory.
 */
export function useOrderJourney(orderNo: string | null) {
  const timeline = useTrackerTimeline(orderNo ?? "", {
    query: { enabled: orderNo !== null },
  });
  const flow = useTrackerFlow();
  const order = timeline.data?.data;
  const journey = useMemo(() => {
    if (!order || !flow.data) return null;
    return buildJourney({
      current: stepOfStatus(flow.data.data, order.status.code),
      events: order.steps,
      stepTimes: STEP_TIMES.sales,
      today: todayInSingapore(),
    });
  }, [order, flow.data]);
  return { timeline, flow, order, journey };
}
