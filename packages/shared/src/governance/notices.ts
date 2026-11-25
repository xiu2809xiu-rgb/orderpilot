import { z } from "zod";
import { pageMetaSchema } from "../envelope.js";
import { permissionSchema } from "../permissions.js";
import { roleSchema } from "../roles.js";

/**
 * A notice to the management approvers (#383): the administrator's role gained
 * permissions. The administrator can widen its own role alone and reads the
 * trail where that is recorded, so the people who decide approvals are told.
 * The web words it; nothing here is a sentence.
 */
export const governanceNoticeSchema = z.object({
  id: z.uuid(),
  kind: z.literal("admin-role-widened"),
  /** Who changed the matrix, by name only. */
  actorName: z.string().min(1),
  /** What the administrator's role gained, in the matrix's order. */
  permissions: z.array(permissionSchema).min(1),
  /** The role it was copied from, or null for one cell. */
  fromRole: roleSchema.nullable(),
  createdAt: z.iso.datetime(),
  /** Whether the person asking has marked it read. */
  read: z.boolean(),
});
export type GovernanceNotice = z.infer<typeof governanceNoticeSchema>;

export const governanceNoticeListResponseSchema = z.object({
  data: z.array(governanceNoticeSchema),
  meta: pageMetaSchema.extend({
    /** How many the person asking has not read: the bell's count. */
    unread: z.int().min(0),
  }),
});

export const governanceNoticeResponseSchema = z.object({
  data: governanceNoticeSchema,
});

export const governanceNoticeParamsSchema = z.object({ id: z.uuid() });
