import { pictureRefusalSchema, type PictureRefusal } from "@orderpilot/shared";
import { ApiError } from "@/lib/api/errors";

/**
 * The refusal code the server gave for a picture: `details[0].message` of the
 * one error envelope, or "too_big" for a 413, which carries no details. Null
 * for any other failure, which the card words from its error code instead.
 */
export function refusalOf(error: unknown): PictureRefusal | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 413) return "too_big";
  const first = error.details[0];
  if (first?.path !== "picture") return null;
  const parsed = pictureRefusalSchema.safeParse(first.message);
  return parsed.success ? parsed.data : null;
}
