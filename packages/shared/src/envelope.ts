import { z } from "zod";

export const pageMetaSchema = z.object({
  page: z.int().min(1),
  pageSize: z.int().min(1).max(200),
  total: z.int().min(0),
});
export type PageMeta = z.infer<typeof pageMetaSchema>;

/** `{ data }` for one record. */
export function dataEnvelope<T extends z.ZodType>(data: T) {
  return z.object({ data });
}

/** `{ data, meta }` for a page of records. */
export function pageEnvelope<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), meta: pageMetaSchema });
}

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;
