import {
  dataEnvelope,
  documentTypeConfigSchema,
  mockEnvelope,
  mockPageEnvelope,
  openRuleSchema,
  orderFlowSchema,
  paymentResultSchema,
  paymentUndoResultSchema,
  sprDecisionResultSchema,
  sprDecisionUndoResultSchema,
  sprDetailSchema,
  taskActionResultSchema,
  workflowReminderSchema,
  handedTaskSchema,
  pageEnvelope,
  taskSlaSchema,
  workflowNoticeSchema,
  workflowTaskSchema,
} from "@orderpilot/shared";
import { z } from "zod";

// The response shapes of the area 2 routes, written once so the controller and
// the OpenAPI file (and so the generated web hooks) cannot drift apart.
export const taskListResponseSchema = mockPageEnvelope(workflowTaskSchema);
export const noticeListResponseSchema = pageEnvelope(workflowNoticeSchema);
export const taskSlaListResponseSchema = dataEnvelope(z.array(taskSlaSchema));
export const taskSlaResponseSchema = dataEnvelope(taskSlaSchema);
export const handedTaskListResponseSchema = mockPageEnvelope(handedTaskSchema);
export const reminderListResponseSchema = mockPageEnvelope(
  workflowReminderSchema,
);
/** A running order's flow is real, so `mock` is false for it, and true for a sample. */
export const orderFlowResponseSchema = z.object({
  data: orderFlowSchema,
  meta: z.object({ mock: z.boolean() }),
});
export const sprResponseSchema = mockEnvelope(sprDetailSchema);
export const sprDecisionResponseSchema = dataEnvelope(sprDecisionResultSchema);
export const paymentResponseSchema = mockEnvelope(paymentResultSchema);
export const paymentUndoResponseSchema = mockEnvelope(paymentUndoResultSchema);
export const sprDecisionUndoResponseSchema = dataEnvelope(
  sprDecisionUndoResultSchema,
);
export const taskActionResponseSchema = mockEnvelope(taskActionResultSchema);
export const openRulesResponseSchema = mockEnvelope(z.array(openRuleSchema));
/** Configuration is real data from the database, so it carries no `meta.mock`. */
export const documentConfigResponseSchema = dataEnvelope(
  z.array(documentTypeConfigSchema),
);
