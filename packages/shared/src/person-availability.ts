// The availability contract (ADR 0070): the API implements it, the web app
// calls it by hand with apiClient.call. Paths are relative to API_BASE_PATH.
// An availability is information for colleagues and nothing else: no rule,
// reminder or approval reads it. The word is "availability": "status" already
// means an order's status, and "ITEM_AVAILABILITIES" in master-data.ts is
// stock cover, which is why every name here carries "Person".

import { z } from "zod";
import { dataEnvelope } from "./envelope.js";

/** Available is the default and is stored as no row at all. */
export const PERSON_AVAILABILITIES = [
  "AVAILABLE",
  "FOCUSING",
  "DO_NOT_DISTURB",
] as const;
export const personAvailabilitySchema = z.enum(PERSON_AVAILABILITIES);
export type PersonAvailability = z.infer<typeof personAvailabilitySchema>;

/** How long a choice of Focusing or Do not disturb lasts. Worked out when it is read. */
export const PERSON_AVAILABILITY_HOLD_HOURS = 12;
export const PERSON_AVAILABILITY_LOOKUP_MAX_IDS = 100;

/** The caller's own availability, with when it ends. Null times mean nothing is set. */
export const myAvailabilitySchema = z.object({
  value: personAvailabilitySchema,
  setAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
});
export type MyAvailability = z.infer<typeof myAvailabilitySchema>;

/**
 * Strict on purpose: who is meant is always the caller of the session, and a
 * time is always the server's, so a `userId` or a `setAt` is refused.
 */
export const setAvailabilityRequestSchema = z.strictObject({
  value: personAvailabilitySchema,
});
export type SetAvailabilityRequest = z.infer<
  typeof setAvailabilityRequestSchema
>;

/**
 * Someone else's: the id, the value and the time, nothing more (no name, role
 * or email). A null `setAt` means nothing is set, not that the person is
 * missing: an unknown id answers the same way.
 */
export const availabilityEntrySchema = z.object({
  userId: z.uuid(),
  value: personAvailabilitySchema,
  setAt: z.iso.datetime().nullable(),
});
export type AvailabilityEntry = z.infer<typeof availabilityEntrySchema>;

/** One uuid and its comma: 36 characters and a separator. */
const MAX_IDS_LENGTH = PERSON_AVAILABILITY_LOOKUP_MAX_IDS * 37;

function partsOf(ids: string): string[] {
  return ids.split(",");
}

/**
 * A comma list, not an array and not a transform: the precedent of
 * `availableStockQuerySchema`. Each part is checked by z.uuid(), so no pattern
 * is built from a string and a space or a trailing comma is a refusal.
 */
export const availabilityLookupQuerySchema = z.object({
  ids: z
    .string()
    .max(MAX_IDS_LENGTH)
    .refine(
      (ids) => {
        const parts = partsOf(ids);
        return (
          parts.length <= PERSON_AVAILABILITY_LOOKUP_MAX_IDS &&
          parts.every((part) => z.uuid().safeParse(part).success)
        );
      },
      {
        message: `Ask for 1 to ${String(PERSON_AVAILABILITY_LOOKUP_MAX_IDS)} user ids, separated by commas`,
      },
    ),
});
export type AvailabilityLookupQuery = z.infer<
  typeof availabilityLookupQuerySchema
>;

/**
 * The distinct ids of a lookup, lower-cased, in the order first asked.
 * z.uuid() accepts upper-case hex and the database returns lower-case ids, so
 * without this an upper-case id would read as Available and the same person
 * asked in two cases would appear twice.
 */
export function lookupIdsOf(query: AvailabilityLookupQuery): string[] {
  return [...new Set(partsOf(query.ids).map((id) => id.toLowerCase()))];
}

export const myAvailabilityResponseSchema = dataEnvelope(myAvailabilitySchema);
export const availabilityLookupResponseSchema = dataEnvelope(
  z.array(availabilityEntrySchema),
);

interface PersonAvailabilityRoute<
  Req extends z.ZodType | null,
  Res extends z.ZodType,
> {
  method: "GET" | "PUT";
  path: string;
  /** True when the call must send the CSRF header. */
  csrf: boolean;
  request: Req;
  response: Res;
}

// Its own helper: the one in auth-routes.ts is not exported and has no PUT.
function route<Req extends z.ZodType | null, Res extends z.ZodType>(
  r: PersonAvailabilityRoute<Req, Res>,
): PersonAvailabilityRoute<Req, Res> {
  return r;
}

export const personAvailabilityRoutes = {
  mine: route({
    method: "GET",
    path: "/availability/mine",
    csrf: false,
    request: null,
    response: myAvailabilityResponseSchema,
  }),
  set: route({
    method: "PUT",
    path: "/availability/mine",
    csrf: true,
    request: setAvailabilityRequestSchema,
    response: myAvailabilityResponseSchema,
  }),
  // The ids go in the query: `?ids=<uuid>,<uuid>`. `request` is null because a
  // GET has no body.
  lookup: route({
    method: "GET",
    path: "/availability",
    csrf: false,
    request: null,
    response: availabilityLookupResponseSchema,
  }),
} as const;
