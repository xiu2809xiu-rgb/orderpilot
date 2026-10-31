import { z } from "zod";
import { pageMetaSchema } from "../envelope.js";
import type { Role } from "../roles.js";

/**
 * Every route in the area 2 base answers with typed mock data built from the
 * synthetic dataset, and says so: `meta.mock` is true and the screens show the
 * Mock badge. When a route is wired to the database (Azri's stories), it drops
 * `meta.mock` and this schema goes with it.
 */
export const MOCK_DATA_LABEL = "Synthetic demo data" as const;

export const mockMetaSchema = z.object({
  mock: z.literal(true),
  dataLabel: z.literal(MOCK_DATA_LABEL),
});
export type MockMeta = z.infer<typeof mockMetaSchema>;

/** `{ data, meta: { mock } }` for one record. */
export function mockEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data, meta: mockMetaSchema });
}

/** `{ data, meta: { page, pageSize, total, mock } }` for a page of records. */
export function mockPageEnvelope<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: pageMetaSchema.extend(mockMetaSchema.shape),
  });
}

/**
 * The roles that have a task inbox. The others (system admin, management,
 * auditor) have no tasks of their own; they may look at any inbox.
 */
export const INBOX_ROLES = [
  "PRODUCT_MANAGER",
  "APPROVER",
  "SUPPORT",
  "WAREHOUSE",
  "FINANCE",
  "LOGISTICS",
] as const satisfies readonly Role[];
export const inboxRoleSchema = z.enum(INBOX_ROLES);
export type InboxRole = z.infer<typeof inboxRoleSchema>;

/** Navision's sales order number, as the sample data writes it: `SO-0003`. */
export const orderNoSchema = z.string().regex(/^[A-Za-z0-9-]{1,30}$/);

/**
 * What a command answers while the base has no state machine behind it: it was
 * understood, permission-checked and validated, and it changed nothing.
 */
export const notAppliedSchema = z.object({
  applied: z.literal(false),
  message: z.string(),
});
export const NOT_APPLIED_MESSAGE =
  "Nothing was changed. The workflow engine is not built yet, so this was only checked.";
