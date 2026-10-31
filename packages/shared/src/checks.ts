// Area 3's contracts (Iok Teck): check rules and results, exceptions, the
// tracker, an order's timeline and the five KPIs. The base (D-1) fixes the
// shapes; the rules, tolerances, exception flow and formulas are area 3's to
// write. Everything the routes return today is mock data and says so in
// `meta.mock`.
//
// Order status is area 2's. Here a status is only the label area 2 reports:
// `{ code, label }` with a code this package does not enumerate.

import { z } from "zod";
import { pageMetaSchema } from "./envelope.js";
import { documentTypeSchema } from "./order.js";
import { roleSchema } from "./roles.js";

/** Stamped on every response that is not computed from real events yet. */
export const mockMetaSchema = z.object({ mock: z.literal(true) });

/** `{ data, meta: { mock: true } }` for one mock record. */
export function mockEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: mockMetaSchema });
}

/** `{ data, meta: { page, pageSize, total, mock: true } }` for a page of mock records. */
export function mockPageEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: pageMetaSchema.extend(mockMetaSchema.shape),
  });
}

// ---- Check results ---------------------------------------------------------

export const CHECK_OUTCOMES = ["pass", "fail"] as const;
export const checkOutcomeSchema = z.enum(CHECK_OUTCOMES);
export type CheckOutcome = z.infer<typeof checkOutcomeSchema>;

/** A tolerance is configuration, and its value is shown in every result. */
export const toleranceSchema = z.object({
  /** What it measures, in words, such as "Quantity difference (units)". */
  label: z.string().min(1),
  /** A decimal string, "0" for an exact match. */
  value: z.string().min(1),
});
export type Tolerance = z.infer<typeof toleranceSchema>;

/** A pointer to the document and field a result was read from. */
export const evidenceRefSchema = z.object({
  documentId: z.string().min(1),
  documentType: documentTypeSchema,
  /** The line or field, such as "line 2: quantity". */
  location: z.string().min(1),
  value: z.string(),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

/**
 * What one rule says about one order: pass or fail, what was expected, what
 * was found, the tolerance and the evidence. Navision numbers identify the
 * parties and items, never names.
 */
export const checkResultSchema = z.object({
  id: z.string().min(1),
  /** The rule's stable name. Mock results use the `mock.` prefix. */
  ruleId: z.string().min(1),
  ruleLabel: z.string().min(1),
  orderNo: z.string().min(1),
  outcome: checkOutcomeSchema,
  expected: z.string(),
  actual: z.string(),
  tolerance: toleranceSchema,
  evidence: z.array(evidenceRefSchema),
  checkedAt: z.iso.datetime(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

/**
 * What area 3 reports to area 2 when a check finishes (event
 * `check.completed`). Area 2's state machine decides what a failure holds up;
 * this payload carries no instruction. The event name is a proposal until the
 * team agrees the event contract in Week 3.
 */
export const checkCompletedSchema = z.object({
  event: z.literal("check.completed"),
  orderNo: z.string().min(1),
  ruleId: z.string().min(1),
  outcome: checkOutcomeSchema,
  resultId: z.string().min(1),
  evidence: z.array(evidenceRefSchema),
});
export type CheckCompleted = z.infer<typeof checkCompletedSchema>;

// ---- Exceptions ------------------------------------------------------------

/** Only the first and last states. Area 3 adds the ones between (assign, escalate). */
export const EXCEPTION_STATES = ["OPEN", "RESOLVED"] as const;
export const exceptionStateSchema = z.enum(EXCEPTION_STATES);
export type ExceptionState = z.infer<typeof exceptionStateSchema>;

/** One failed check waiting for a person: what differs, by how much, who should fix it. */
export const exceptionSchema = z.object({
  id: z.string().min(1),
  orderNo: z.string().min(1),
  customerNo: z.string().min(1),
  customerName: z.string().min(1),
  ruleId: z.string().min(1),
  ruleLabel: z.string().min(1),
  /** What differs, in a sentence. */
  summary: z.string().min(1),
  expected: z.string(),
  actual: z.string(),
  difference: z.string(),
  tolerance: toleranceSchema,
  /** The role who should fix it. */
  fixBy: roleSchema,
  state: exceptionStateSchema,
  openedAt: z.iso.datetime(),
});
export type CheckException = z.infer<typeof exceptionSchema>;

// ---- Order status, as area 2 reports it -------------------------------------

/** The code is area 2's and opaque here. The label is what the screens show. */
export const reportedStatusSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
});
export type ReportedStatus = z.infer<typeof reportedStatusSchema>;

// ---- The tracker -----------------------------------------------------------

export const overdueFlagSchema = z.object({
  overdue: z.boolean(),
  daysOverdue: z.int().min(0),
  /** Why, in words, when overdue. */
  reason: z.string().nullable(),
});
export type OverdueFlag = z.infer<typeof overdueFlagSchema>;

export const trackerOrderSchema = z.object({
  orderNo: z.string().min(1),
  externalDocumentNo: z.string().min(1),
  customerNo: z.string().min(1),
  customerName: z.string().min(1),
  status: reportedStatusSchema,
  ownerRole: roleSchema,
  overdue: overdueFlagSchema,
  openExceptions: z.int().min(0),
  shipmentDate: z.iso.date().nullable(),
  orderDate: z.iso.date(),
});
export type TrackerOrder = z.infer<typeof trackerOrderSchema>;

export const TRACKER_SORT_COLUMNS = [
  "orderNo",
  "customerName",
  "orderDate",
  "shipmentDate",
] as const;

export const trackerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().max(100).optional(),
  sort: z.enum(TRACKER_SORT_COLUMNS).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  overdue: z.enum(["true", "false"]).optional(),
});
export type TrackerQuery = z.infer<typeof trackerQuerySchema>;

export const trackerListSchema = mockPageEnvelope(trackerOrderSchema);

// ---- An order's timeline ----------------------------------------------------

export const timelineStepSchema = z.object({
  id: z.string().min(1),
  at: z.iso.datetime(),
  /** Who did it: a role, or "System" for an automatic step. */
  actor: z.string().min(1),
  title: z.string().min(1),
  /** What the step changed, in our own words: "Payment confirmed: packing released". */
  effect: z.string().min(1),
  /** True for the order's current step. */
  current: z.boolean(),
});
export type TimelineStep = z.infer<typeof timelineStepSchema>;

/** A candidate with a similar name but another Navision number. */
export const possibleMatchSchema = z.object({
  no: z.string().min(1),
  name: z.string().min(1),
});

/**
 * A party or item on the documents, matched to master data by its Navision
 * number. Names are shown, never used to match. A look-alike name is listed
 * as a possible match for a person to look at.
 */
export const masterMatchSchema = z.object({
  kind: z.enum(["customer", "item"]),
  /** The number as printed on the document. */
  printedNo: z.string().min(1),
  /** The name as printed on the document. */
  printedName: z.string().min(1),
  matchedNo: z.string().min(1).nullable(),
  matchedName: z.string().min(1).nullable(),
  possibleMatches: z.array(possibleMatchSchema),
});
export type MasterMatch = z.infer<typeof masterMatchSchema>;

export const orderTimelineSchema = z.object({
  orderNo: z.string().min(1),
  externalDocumentNo: z.string().min(1),
  customerNo: z.string().min(1),
  customerName: z.string().min(1),
  status: reportedStatusSchema,
  ownerRole: roleSchema,
  overdue: overdueFlagSchema,
  steps: z.array(timelineStepSchema),
  checks: z.array(checkResultSchema),
  matches: z.array(masterMatchSchema),
});
export type OrderTimeline = z.infer<typeof orderTimelineSchema>;

export const orderTimelineResponseSchema = mockEnvelope(orderTimelineSchema);

// ---- The exceptions queue ---------------------------------------------------

/** A page of the queue, with a quick search over order, customer, rule and summary. */
export const exceptionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().trim().max(100).optional(),
});
export type ExceptionQuery = z.infer<typeof exceptionQuerySchema>;

export const exceptionQueueSchema = mockPageEnvelope(exceptionSchema);

// ---- The five KPIs ----------------------------------------------------------

/** Spectra's five measures ([success metrics](../../../docs/design-thinking/success-metrics.md)). */
export const KPI_IDS = [
  "processingTime",
  "manualTouches",
  "dataEntryErrors",
  "approvalTurnaround",
  "overdueOrders",
] as const;
export const kpiIdSchema = z.enum(KPI_IDS);
export type KpiId = z.infer<typeof kpiIdSchema>;

export const kpiSchema = z.object({
  id: kpiIdSchema,
  label: z.string().min(1),
  unit: z.string().min(1),
  /** Today's way of working, from the protocol. A lab estimate. */
  manual: z.number(),
  /** With OrderPilot, from the protocol. A lab estimate. */
  withOrderPilot: z.number(),
  /** True when a lower number is better. */
  lowerIsBetter: z.boolean(),
  /** How it is calculated, in words. Draft wording for area 3 to own. */
  definition: z.string().min(1),
});
export type Kpi = z.infer<typeof kpiSchema>;

export const kpiSetSchema = z.object({
  /** Always true until Spectra gives real numbers (Q-7). */
  labEstimate: z.literal(true),
  note: z.string().min(1),
  measures: z.array(kpiSchema).length(KPI_IDS.length),
});
export type KpiSet = z.infer<typeof kpiSetSchema>;

export const kpiResponseSchema = mockEnvelope(kpiSetSchema);
