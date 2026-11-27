import { pageEnvelope, userRefSchema } from "@orderpilot/shared";
import { z } from "zod";

/** A user as an administrator sees them. Never a password or a hash. */
export const userSchema = userRefSchema.extend({
  disabled: z.boolean(),
  disabledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type UserView = z.infer<typeof userSchema>;

/** What a reset did: whether two-step was on, and how many sessions it ended. */
export const twoStepResetSchema = z.object({
  wasOn: z.boolean(),
  sessionsEnded: z.number().int().nonnegative(),
});
export type TwoStepReset = z.infer<typeof twoStepResetSchema>;
export const twoStepResetResponseSchema = z.object({
  data: twoStepResetSchema,
});

export const userParamsSchema = z.object({ id: z.uuid() });

export const userResponseSchema = z.object({ data: userSchema });
export const userListResponseSchema = pageEnvelope(userSchema);
