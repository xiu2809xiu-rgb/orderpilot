import { pageEnvelope, userRefSchema } from "@orderpilot/shared";
import { z } from "zod";

/** A user as an administrator sees them. Never a password or a hash. */
export const userSchema = userRefSchema.extend({
  disabled: z.boolean(),
  disabledAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type UserView = z.infer<typeof userSchema>;

export const userParamsSchema = z.object({ id: z.uuid() });

export const userResponseSchema = z.object({ data: userSchema });
export const userListResponseSchema = pageEnvelope(userSchema);
