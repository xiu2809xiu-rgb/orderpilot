import type { PictureStatus } from "@orderpilot/shared";

/** What the rule needs to know about a stored picture. */
export interface VisiblePicture {
  readonly status: PictureStatus;
  readonly userId: string;
  /** Set when a demo session sent it: that sign-in's family. Null for a normal account. */
  readonly sessionFamilyId: string | null;
  /** A disabled person's pictures are shown to nobody: the account is switched off. */
  readonly ownerDisabled: boolean;
}

export interface PictureViewer {
  readonly userId: string;
  /** The family of this sign-in (AuthContext.sessionId). */
  readonly sessionId: string;
}

/**
 * Who may see a picture's bytes (ADR 0069). An approved picture goes to any
 * signed-in person. A pending one goes only to the reviewers and to its owner,
 * and in a demo session, where every visitor of a role is one account, its
 * owner is the sign-in that sent it. A rejected or removed picture has no
 * bytes left and goes to nobody.
 */
export class PictureVisibility {
  canSee(
    picture: VisiblePicture,
    viewer: PictureViewer,
    viewerIsReviewer: boolean,
  ): boolean {
    if (picture.ownerDisabled) return false;
    if (picture.status === "APPROVED") return true;
    if (picture.status !== "PENDING") return false;
    if (viewerIsReviewer) return true;
    if (picture.userId !== viewer.userId) return false;
    return (
      picture.sessionFamilyId === null ||
      picture.sessionFamilyId === viewer.sessionId
    );
  }
}
