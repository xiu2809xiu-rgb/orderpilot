import { z } from "zod";

/**
 * What the clickstream may hold. Four fields and nothing that names a person:
 * the role comes from the session on the server, never from the browser, and
 * there is no user id, no address, no query string and no record id.
 */
export const CLICKSTREAM_EVENT_NAMES = [
  "page_view",
  "action",
  "error_shown",
] as const;
export const clickstreamEventNameSchema = z.enum(CLICKSTREAM_EVENT_NAMES);
export type ClickstreamEventName = z.infer<typeof clickstreamEventNameSchema>;

/** The most events one request may carry. The tracker sends fewer. */
export const CLICKSTREAM_MAX_BATCH = 20;

const SEGMENT = /^(:[A-Za-z][A-Za-z0-9]*|[a-z][a-z0-9-]*)$/;

/**
 * A route pattern such as `/orders/:id`, never a raw URL. A segment is a word
 * or a `:parameter`, so a record id, a number, a query string or a fragment
 * cannot get in by mistake.
 */
export const routePatternSchema = z
  .string()
  .max(120)
  .refine(
    (value) =>
      value === "/" ||
      (value.startsWith("/") &&
        value
          .slice(1)
          .split("/")
          .every((segment) => SEGMENT.test(segment))),
    "Use a route pattern such as /orders/:id",
  );

export const clickstreamEventSchema = z
  .object({
    name: clickstreamEventNameSchema,
    route: routePatternSchema,
    /** When it happened in the browser. The server keeps it only if it is plausible. */
    at: z.iso.datetime(),
  })
  // Strict on purpose: a field nobody planned (a user id) is refused, not dropped.
  .strict();
export type ClickstreamEvent = z.infer<typeof clickstreamEventSchema>;

export const clickstreamBatchSchema = z
  .object({
    events: z.array(clickstreamEventSchema).min(1).max(CLICKSTREAM_MAX_BATCH),
  })
  .strict();
export type ClickstreamBatch = z.infer<typeof clickstreamBatchSchema>;

export const clickstreamAcceptedSchema = z.object({
  data: z.object({ accepted: z.int().min(0) }),
});
