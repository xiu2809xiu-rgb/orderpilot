import { z } from "zod";
import { pageQuerySchema } from "../envelope.js";
import { roleSchema } from "../roles.js";

/**
 * An audit event is a refusal when its action ends in one of these. The
 * auth layer writes `auth.<what>.refused`, and a reused refresh token is
 * `auth.refresh.reuse-detected`. Area 4 may add more as the policy lands.
 */
export const REFUSAL_ACTION_SUFFIXES = [".refused", ".reuse-detected"] as const;

export function isRefusalAction(action: string): boolean {
  return REFUSAL_ACTION_SUFFIXES.some((suffix) => action.endsWith(suffix));
}

const flagSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

/**
 * What the audit list can be narrowed by. Every filter is optional and they
 * combine with "and". The time range is inclusive at both ends.
 */
export const auditEventQuerySchema = pageQuerySchema
  .extend({
    actorKind: z.enum(["user", "system", "ai"]).optional(),
    actorUserId: z.uuid().optional(),
    role: roleSchema.optional(),
    /** Matches an action that starts with this text, so "auth." finds every sign-in event. */
    action: z.string().trim().min(1).max(100).optional(),
    entityType: z.string().trim().min(1).max(100).optional(),
    entityId: z.string().trim().min(1).max(200).optional(),
    from: z.iso.datetime().optional(),
    to: z.iso.datetime().optional(),
    refusalsOnly: flagSchema.optional(),
    /** Words in the summary, ignoring case. */
    search: z.string().trim().min(1).max(100).optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "The start of the range must not be after its end",
    path: ["from"],
  });
export type AuditEventQuery = z.infer<typeof auditEventQuerySchema>;
