import { useMemo } from "react";
import { todayInSingapore } from "@/lib/format";
import {
  useTrackerFlow,
  useTrackerTimeline,
} from "@/lib/api/generated/endpoints/tracker/tracker";
import { STEP_TIMES } from "../../data/index";
import { stepOfStatus } from "../orders/orderRow";
import { buildJourney } from "./journeyModel";
import { stepBegan } from "./stepBegan";
import { useOrderFlow } from "./useOrderFlow";

/**
 * An order's timeline from the tracker, the flow that says which step its
 * status is, and the journey worked out from both and the measured step
 * times. Nothing is read twice: the Orders list asks for the same flow, so
 * TanStack Query answers it from memory.
 *
 * How long the order has waited at its step comes from the workflow's record,
 * which the order's page reads anyway: the tracker's sample timeline stamps
 * its newest event with today, so it cannot say. While that record is on its
 * way no wait is said, so the line never shows one figure and then another.
 * A role that may not read the record, or an order it does not know, keeps
 * the tracker's time.
 */
export function useOrderJourney(orderNo: string | null) {
  const timeline = useTrackerTimeline(orderNo ?? "", {
    query: { enabled: orderNo !== null },
  });
  const flow = useTrackerFlow();
  const record = useOrderFlow(orderNo ?? "", orderNo !== null);
  const order = timeline.data?.data;
  const recordSteps = record.data?.data.steps;
  const recordLoading = record.isLoading;
  const journey = useMemo(() => {
    if (!order || !flow.data) return null;
    return buildJourney({
      current: stepOfStatus(flow.data.data, order.status.code),
      events: order.steps,
      stepTimes: STEP_TIMES.sales,
      today: todayInSingapore(),
      since: recordLoading ? null : stepBegan(recordSteps),
    });
  }, [order, flow.data, recordSteps, recordLoading]);
  return { timeline, flow, order, journey };
}
