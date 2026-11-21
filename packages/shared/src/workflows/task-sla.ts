import { z } from "zod";
import { pageQuerySchema } from "../envelope.js";
import { roleSchema } from "../roles.js";
import { orderNoSchema } from "./common.js";
import { taskKindSchema, type TaskKind } from "./tasks.js";

/** At most a year: any more is a mistake, and it must fit the column. */
const minutes = z.number().int().positive().max(525_600);

const timings = z.object({
  /** How long after the task is created it is due. */
  dueAfterMinutes: minutes,
  /** How long before it is due the owner is reminded. */
  remindBeforeMinutes: minutes,
  /** How long after it is due it escalates. Zero means the moment it is due. */
  escalateAfterMinutes: z.number().int().min(0).max(525_600),
  /** Who is told when nobody acts. */
  escalateToRole: roleSchema,
});

/** When a kind of task is due, and what happens around it. Configuration, not code. */
export const taskSlaSchema = timings.extend({ taskKind: taskKindSchema });
export type TaskSla = z.infer<typeof taskSlaSchema>;

export const taskSlaChangeSchema = timings.refine(
  (sla) => sla.remindBeforeMinutes < sla.dueAfterMinutes,
  {
    path: ["remindBeforeMinutes"],
    message: "The reminder must go after the task starts, before it is due.",
  },
);
export type TaskSlaChange = z.infer<typeof taskSlaChangeSchema>;

export const taskSlaParamsSchema = z.object({ taskKind: taskKindSchema });

const HOUR = 60;

/**
 * What the seed starts from. Spectra's one stated rule is an approval not actioned
 * in 24 hours going to the management approvers. The rest are our drafts (A-37).
 */
const draft = (
  taskKind: TaskKind,
  dueAfterHours: number,
  remindBeforeHours: number,
  escalateAfterHours: number,
): TaskSla => ({
  taskKind,
  dueAfterMinutes: dueAfterHours * HOUR,
  remindBeforeMinutes: remindBeforeHours * HOUR,
  escalateAfterMinutes: escalateAfterHours * HOUR,
  escalateToRole: "APPROVER",
});

export const DEFAULT_TASK_SLAS: readonly TaskSla[] = [
  draft("REVIEW_FIELDS", 8, 2, 8),
  draft("RAISE_SPR", 24, 4, 24),
  draft("APPROVE_SPR", 24, 4, 0),
  draft("PLACE_VENDOR_PO", 24, 4, 24),
  draft("SEND_PI", 24, 4, 24),
  draft("CONFIRM_PAYMENT", 48, 8, 24),
  draft("PACK_ORDER", 48, 8, 24),
  draft("RECOUNT_CARTONS", 8, 2, 8),
  draft("ADD_SHIPPING_DOCUMENTS", 72, 24, 24),
];

export const NOTICE_KINDS = ["REMINDER", "ESCALATION"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

/** A reminder or an escalation that has really gone out, to this person or their role. */
export const workflowNoticeSchema = z.object({
  id: z.uuid(),
  kind: z.enum(NOTICE_KINDS),
  /** The screen says what this is about, in the reader's language. */
  taskKind: taskKindSchema,
  orderNo: orderNoSchema,
  dueAt: z.iso.datetime(),
  sentAt: z.iso.datetime(),
});
export type WorkflowNotice = z.infer<typeof workflowNoticeSchema>;

export const noticesQuerySchema = pageQuerySchema;
