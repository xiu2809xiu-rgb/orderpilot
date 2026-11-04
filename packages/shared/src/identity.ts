import { z } from "zod";
import { pageQuerySchema } from "./envelope.js";
import { permissionSchema } from "./permissions.js";
import { roleSchema } from "./roles.js";

/**
 * A page of users. `active` keeps the enabled ("true") or the disabled
 * ("false"), `role` keeps one role, and `search` finds words in the name or
 * the email address, ignoring case.
 */
export const userListQuerySchema = pageQuerySchema.extend({
  active: z.enum(["true", "false"]).optional(),
  role: roleSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

/** Who a record points at: enough to show a name and a role, never a password or a hash. */
export const userRefSchema = z.object({
  id: z.uuid(),
  displayName: z.string().min(1),
  email: z.email(),
  role: roleSchema,
});
export type UserRef = z.infer<typeof userRefSchema>;

/** What `GET /auth/me` and the sign-in routes return. */
export const sessionSchema = z.object({
  user: userRefSchema,
  permissions: z.array(permissionSchema),
  // When the access token ends. The web app refreshes before this.
  expiresAt: z.iso.datetime(),
  // True when the user came in through the demo sign-in.
  demo: z.boolean(),
});
export type Session = z.infer<typeof sessionSchema>;
