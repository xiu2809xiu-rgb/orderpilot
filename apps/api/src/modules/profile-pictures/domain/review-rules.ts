import type { PictureRefusal, PictureStatus } from "@orderpilot/shared";

export type PictureRemoval =
  "WITHDRAWN" | "REPLACED_BY_UPLOAD" | "REPLACED_BY_APPROVAL" | "TAKEN_DOWN";

export type ReviewAction = "approve" | "reject" | "take_down";

export interface ReviewedPicture {
  readonly userId: string;
  readonly status: PictureStatus;
  readonly removal: PictureRemoval | null;
}

export type ReviewJudgement =
  { readonly ok: true } | { readonly ok: false; readonly code: PictureRefusal };

/**
 * May this person decide on this picture, in the state it is in now? The
 * judgement is made under the owner's lock, so it is made on the truth.
 * Nobody reviews their own picture, whatever their role: that comes first, so
 * a stale status can never hide it. A picture the owner withdrew or replaced
 * is refused with the reason, so a reviewer's decision never lands on a
 * picture they did not see.
 */
export class PictureReviewRules {
  judge(
    action: ReviewAction,
    actorId: string,
    picture: ReviewedPicture,
  ): ReviewJudgement {
    if (picture.userId === actorId) return { ok: false, code: "own_picture" };
    if (action === "take_down") {
      return picture.status === "APPROVED"
        ? { ok: true }
        : { ok: false, code: "not_approved" };
    }
    if (picture.status === "PENDING") return { ok: true };
    return { ok: false, code: this.conflictCode(picture) };
  }

  /** Why a picture that is not pending cannot be approved or rejected. */
  private conflictCode(picture: ReviewedPicture): PictureRefusal {
    switch (picture.status) {
      case "REJECTED":
        return "already_rejected";
      case "APPROVED":
        return "already_approved";
      case "REMOVED":
        switch (picture.removal) {
          case "WITHDRAWN":
            return "removed_by_owner";
          // Approved once, then replaced by a newer approval or taken down.
          case "REPLACED_BY_APPROVAL":
          case "TAKEN_DOWN":
            return "already_approved";
          default:
            return "replaced";
        }
      default:
        return "replaced";
    }
  }
}
