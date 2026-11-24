import type { ErrorCode, PictureRefusal } from "@orderpilot/shared";
import { DomainError } from "../../../common/domain-error.js";

/**
 * The envelope code each refusal travels under. `too_big` is the one that is
 * not thrown from here: a body over the limit is a 413, which the controller
 * answers itself, and the code is kept for the audit row and the web.
 */
const ENVELOPE_CODE: Record<PictureRefusal, ErrorCode> = {
  wrong_type: "VALIDATION_FAILED",
  empty: "VALIDATION_FAILED",
  not_jpeg: "VALIDATION_FAILED",
  damaged: "VALIDATION_FAILED",
  unsupported: "VALIDATION_FAILED",
  not_square: "VALIDATION_FAILED",
  wrong_size: "VALIDATION_FAILED",
  cut_off: "VALIDATION_FAILED",
  too_big: "VALIDATION_FAILED",
  rejected_before: "VALIDATION_FAILED",
  upload_limit: "RATE_LIMITED",
  upload_busy: "RATE_LIMITED",
  own_picture: "FORBIDDEN",
  already_approved: "CONFLICT",
  already_rejected: "CONFLICT",
  removed_by_owner: "CONFLICT",
  replaced: "CONFLICT",
  not_approved: "CONFLICT",
};

/** Plain English for logs and `.http` users. The web words each code itself. */
const MESSAGE: Record<PictureRefusal, string> = {
  wrong_type: "Send the picture as a JPEG (Content-Type image/jpeg).",
  empty: "No picture was sent.",
  not_jpeg: "This file is not a JPEG picture.",
  damaged: "This picture file is damaged or incomplete.",
  unsupported: "This kind of JPEG is not supported.",
  not_square: "The picture must be square.",
  wrong_size: "The picture must be between 128 and 512 pixels wide.",
  cut_off: "The upload was cut off.",
  too_big: "The picture is larger than 256 KB.",
  rejected_before: "A reviewer did not approve this picture before.",
  upload_limit: "Too many pictures were sent in the last 24 hours.",
  upload_busy: "Another picture of yours is still being sent.",
  own_picture: "You cannot review your own picture.",
  already_approved: "This picture was already approved.",
  already_rejected: "This picture was already rejected.",
  removed_by_owner: "The owner removed this picture.",
  replaced: "The owner sent a newer picture.",
  not_approved: "Only an approved picture can be taken down.",
};

/**
 * A picture was refused. `details[0].message` is the machine code from
 * `PICTURE_REFUSALS` (ADR 0069): the web turns it into its own words, so the
 * envelope's `message` can stay English for the people who read logs.
 */
export class PictureRefusalError extends DomainError {
  constructor(readonly refusal: PictureRefusal) {
    super(ENVELOPE_CODE[refusal], MESSAGE[refusal], [
      { path: "picture", message: refusal },
    ]);
  }
}
