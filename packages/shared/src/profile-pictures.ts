import { z } from "zod";
import { apiPath } from "./auth-routes.js";
import { pageEnvelope, pageQuerySchema, dataEnvelope } from "./envelope.js";
import { userRefSchema } from "./identity.js";

// Profile pictures a person approves (ADR 0069). The browser prepares a small
// square JPEG; the server checks it again, cleans it and keeps it for review.
// Fixed rules refuse a bad file, an AI check (only when the data rule allows
// one) tells the reviewer what it sees, and a person approves or rejects.

export const PROFILE_PICTURE_LIMITS = {
  /** The largest body the upload route reads. */
  maxBytes: 262_144,
  minSide: 128,
  maxSide: 512,
  uploadsPer24Hours: 10,
  /** A rejected or taken-down file sent again inside this many days is refused. */
  rejectedRepeatDays: 30,
} as const;

export const PICTURE_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REMOVED",
] as const;
export const pictureStatusSchema = z.enum(PICTURE_STATUSES);
export type PictureStatus = z.infer<typeof pictureStatusSchema>;

/** The two lists a reviewer opens. */
export const PICTURE_LIST_STATUSES = ["PENDING", "APPROVED"] as const;
export type PictureListStatus = (typeof PICTURE_LIST_STATUSES)[number];

/** What the AI check may name. Anything else it says is dropped. */
export const PICTURE_CONCERNS = [
  "nudity_or_sexual_content",
  "violence_or_gore",
  "hateful_symbol_or_text",
  "offensive_gesture",
  "weapon",
  "drugs_or_alcohol",
  "personal_documents_visible",
  "unusable_image",
  "other",
] as const;
export const pictureConcernSchema = z.enum(PICTURE_CONCERNS);
export type PictureConcern = z.infer<typeof pictureConcernSchema>;

export const PICTURE_REJECTION_REASONS = [
  "not_suitable",
  "offensive",
  "not_clear",
  "not_you",
  "personal_information",
  "other",
] as const;
export const PICTURE_TAKE_DOWN_REASONS = [
  ...PICTURE_REJECTION_REASONS,
  "reported",
] as const;
export const pictureRejectionReasonSchema = z.enum(PICTURE_REJECTION_REASONS);
export const pictureTakeDownReasonSchema = z.enum(PICTURE_TAKE_DOWN_REASONS);
export type PictureRejectionReason = z.infer<
  typeof pictureRejectionReasonSchema
>;
export type PictureTakeDownReason = z.infer<typeof pictureTakeDownReasonSchema>;

/**
 * Why a picture was refused. Sent as `details[0].message` of the one error
 * envelope, with `path: "picture"`, so the web words each in its own English.
 * `too_big` is never sent: a 413 carries no details, and the web derives it
 * from the status. It is the code the audit row holds.
 */
export const PICTURE_REFUSALS = [
  "wrong_type",
  "empty",
  "not_jpeg",
  "damaged",
  "unsupported",
  "not_square",
  "wrong_size",
  "cut_off",
  "too_big",
  "upload_limit",
  "upload_busy",
  "rejected_before",
  "own_picture",
  "already_approved",
  "already_rejected",
  "removed_by_owner",
  "replaced",
  "not_approved",
] as const;
export const pictureRefusalSchema = z.enum(PICTURE_REFUSALS);
export type PictureRefusal = z.infer<typeof pictureRefusalSchema>;

export const PICTURE_NOTE_MAX = 140;

/**
 * True when no character is a control character (a code under 32, or 127).
 * A function and not a regular expression: the lint rule against control
 * characters in a pattern would need a disable comment for the literal.
 */
export function hasNoControlCharacters(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 32 || code === 127) return false;
  }
  return true;
}

/** What the owner may read about the AI check: whether one looked, never what it said. */
export const PICTURE_AI_STATUSES = [
  "CHECKED",
  "NOT_ALLOWED",
  "NOT_RUN",
] as const;
export const pictureAiStatusSchema = z.enum(PICTURE_AI_STATUSES);
export type PictureAiStatus = z.infer<typeof pictureAiStatusSchema>;

export const pictureAiOwnerSchema = z.object({ status: pictureAiStatusSchema });
export type PictureAiOwner = z.infer<typeof pictureAiOwnerSchema>;

export const PICTURE_AI_VERDICTS = [
  "LOOKS_FINE",
  "NEEDS_A_CLOSER_LOOK",
] as const;
export const pictureAiVerdictSchema = z.enum(PICTURE_AI_VERDICTS);
export type PictureAiVerdict = z.infer<typeof pictureAiVerdictSchema>;

export const PICTURE_NOTICE_KINDS = ["REJECTED", "TAKEN_DOWN"] as const;
export const pictureNoticeKindSchema = z.enum(PICTURE_NOTICE_KINDS);
export type PictureNoticeKind = z.infer<typeof pictureNoticeKindSchema>;

/** The owner's own pictures: the approved one, the one waiting, the last decision against them, and the cap. */
export const myPictureSchema = z.object({
  approved: z.object({ id: z.uuid(), decidedAt: z.iso.datetime() }).nullable(),
  pending: z
    .object({
      id: z.uuid(),
      createdAt: z.iso.datetime(),
      ai: pictureAiOwnerSchema,
    })
    .nullable(),
  notice: z
    .object({
      kind: pictureNoticeKindSchema,
      reasonCode: z.string().min(1),
      note: z.string().nullable(),
      decidedAt: z.iso.datetime(),
    })
    .nullable(),
  uploads: z.object({ used: z.int().min(0), limit: z.int().min(1) }),
});
export type MyPicture = z.infer<typeof myPictureSchema>;
export const myPictureResponseSchema = dataEnvelope(myPictureSchema);

/** One picture as a reviewer sees it. The caller's own pictures are never listed. */
export const reviewItemSchema = z.object({
  id: z.uuid(),
  status: pictureStatusSchema,
  createdAt: z.iso.datetime(),
  decidedAt: z.iso.datetime().nullable(),
  width: z.int(),
  byteSize: z.int(),
  owner: userRefSchema,
  ai: z.object({
    status: pictureAiStatusSchema,
    verdict: pictureAiVerdictSchema.nullable(),
    concerns: z.array(pictureConcernSchema),
    note: z.string().nullable(),
    // The rule id, "timeout", "failed" or "mock". The web words it, never prints it.
    why: z.string().nullable(),
  }),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;
export const reviewItemResponseSchema = dataEnvelope(reviewItemSchema);
export const reviewListResponseSchema = pageEnvelope(reviewItemSchema);

export const pictureListQuerySchema = pageQuerySchema.extend({
  status: z.enum(PICTURE_LIST_STATUSES).default("PENDING"),
});
export type PictureListQuery = z.infer<typeof pictureListQuerySchema>;

/**
 * The body of a rejection or a take-down: a reason from the list and a short
 * note. "other" has no words of its own, so it needs the note.
 */
export function pictureDecisionRequestSchema<
  const Reasons extends readonly [string, ...string[]],
>(reasons: Reasons) {
  return z
    .object({
      reasonCode: z.enum(reasons),
      note: z
        .string()
        .trim()
        .max(PICTURE_NOTE_MAX)
        .refine(hasNoControlCharacters, "The note holds a control character")
        .optional(),
    })
    .superRefine((value, context) => {
      if (value.reasonCode === "other" && !value.note) {
        context.addIssue({
          code: "custom",
          path: ["note"],
          message: "Add a note for another reason",
        });
      }
    });
}
export const pictureRejectRequestSchema = pictureDecisionRequestSchema(
  PICTURE_REJECTION_REASONS,
);
export const pictureTakeDownRequestSchema = pictureDecisionRequestSchema(
  PICTURE_TAKE_DOWN_REASONS,
);
export type PictureRejectRequest = z.infer<typeof pictureRejectRequestSchema>;
export type PictureTakeDownRequest = z.infer<
  typeof pictureTakeDownRequestSchema
>;

/** The path of a picture's bytes, such as /api/v1/profile-pictures/<id>/image. */
export function profilePictureImagePath(pictureId: string): string {
  return apiPath(`/profile-pictures/${pictureId}/image`);
}

/** What the web needs to call the two routes it does not generate. */
interface PictureRoute<Req, Res extends z.ZodType> {
  method: "GET" | "PUT";
  path: string;
  /** True when a state-changing call must send the CSRF header. */
  csrf: boolean;
  /** Null: a GET has none, and the upload's body is raw bytes, not JSON. */
  request: Req;
  response: Res;
  /** Set when the body is raw bytes: the one content type the route takes. */
  rawContentType?: "image/jpeg";
}

export const pictureRoutes = {
  mine: {
    method: "GET",
    path: "/profile-pictures/mine",
    csrf: false,
    request: null,
    response: myPictureResponseSchema,
  } satisfies PictureRoute<null, typeof myPictureResponseSchema>,
  upload: {
    method: "PUT",
    path: "/profile-pictures/mine",
    csrf: true,
    request: null,
    response: myPictureResponseSchema,
    rawContentType: "image/jpeg",
  } satisfies PictureRoute<null, typeof myPictureResponseSchema>,
} as const;
