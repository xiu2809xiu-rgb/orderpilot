import {
  dataEnvelope,
  documentTypeConfigSchema,
  mockEnvelope,
  mockPageEnvelope,
  orderFlowSchema,
  paymentResultSchema,
  sprDecisionResultSchema,
  sprDetailSchema,
  workflowReminderSchema,
  workflowTaskSchema,
} from "@orderpilot/shared";
import { z } from "zod";

// The response shapes of the area 2 routes, written once so the controller and
// the OpenAPI file (and so the generated web hooks) cannot drift apart.
export const taskListResponseSchema = mockPageEnvelope(workflowTaskSchema);
export const reminderListResponseSchema = mockPageEnvelope(
  workflowReminderSchema,
);
export const orderFlowResponseSchema = mockEnvelope(orderFlowSchema);
export const sprResponseSchema = mockEnvelope(sprDetailSchema);
export const sprDecisionResponseSchema = mockEnvelope(sprDecisionResultSchema);
export const paymentResponseSchema = mockEnvelope(paymentResultSchema);
/** Configuration is real data from the database, so it carries no `meta.mock`. */
export const documentConfigResponseSchema = dataEnvelope(
  z.array(documentTypeConfigSchema),
);
