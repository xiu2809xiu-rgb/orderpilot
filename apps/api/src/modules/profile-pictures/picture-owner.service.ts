import { Inject, Injectable } from "@nestjs/common";
import { PROFILE_PICTURE_LIMITS, type MyPicture } from "@orderpilot/shared";
import { NotFoundError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { PictureVisibility } from "./domain/picture-visibility.js";
import { UploadAllowance } from "./domain/upload-allowance.js";
import { PictureAuditor } from "./picture-auditor.js";
import { PictureClock } from "./picture-clock.js";
import { PictureStore, SWEEP_AFTER_CHANGE } from "./picture-store.js";
import type {
  PictureActor,
  PictureRecord,
  PictureRequest,
} from "./picture-types.js";
import { ProfilePictureRepository } from "./profile-picture.repository.js";

/**
 * The person's own side of profile pictures: what `mine` says, and taking a
 * picture back. In a demo session, where every visitor of a role is one
 * account, a picture still waiting is the session's that sent it: another
 * session of the account sees nothing of it, and nothing of a decision on it.
 */
@Injectable()
export class PictureOwnerService {
  private readonly visibility = new PictureVisibility();
  private readonly allowance = new UploadAllowance();

  constructor(
    @Inject(ProfilePictureRepository)
    private readonly pictures: ProfilePictureRepository,
    @Inject(PictureStore) private readonly store: PictureStore,
    @Inject(PictureAuditor) private readonly auditor: PictureAuditor,
    @Inject(PictureClock) private readonly clock: PictureClock,
    @Inject(Database) private readonly database: Database,
  ) {}

  /** The picture shown, the one waiting, the last decision against them, and how many uploads are left. */
  async mine(actor: PictureActor): Promise<MyPicture> {
    const live = await this.pictures.findLiveByUser(actor.userId);
    const approved = live.find((picture) => picture.status === "APPROVED");
    // The owner's own view of a pending row: never the reviewer's.
    const pending = live.find(
      (picture) =>
        picture.status === "PENDING" &&
        this.visibility.canSee(picture, actor, false),
    );
    const used = await this.pictures.countSince(
      actor.userId,
      this.allowance.windowStart(this.clock.now()),
      familyOf(actor),
    );
    return {
      approved: approved
        ? {
            id: approved.id,
            decidedAt: (approved.decidedAt ?? approved.createdAt).toISOString(),
          }
        : null,
      pending: pending
        ? {
            id: pending.id,
            createdAt: pending.createdAt.toISOString(),
            ai: { status: pending.aiStatus },
          }
        : null,
      notice: await this.noticeOf(actor, pending ?? null, approved ?? null),
      uploads: { used, limit: PROFILE_PICTURE_LIMITS.uploadsPer24Hours },
    };
  }

  /**
   * Takes back the person's own pending or approved picture. A picture that is
   * not theirs, or is a demo session's other pending picture, is not found and
   * the attempt is audited. One that is already gone is answered the same way
   * as success and writes nothing.
   */
  async withdraw(
    actor: PictureActor,
    id: string,
    request: PictureRequest,
  ): Promise<MyPicture> {
    const found = await this.pictures.findById(id);
    if (found === null || !this.isTheirs(found, actor)) {
      await this.auditor.withdrawRefused(actor, id, request);
      throw new NotFoundError("Picture");
    }
    const removed = await this.database.transaction(async () => {
      await this.pictures.lockOwner(actor.userId);
      const current = await this.pictures.findById(id);
      if (
        current === null ||
        (current.status !== "PENDING" && current.status !== "APPROVED")
      ) {
        return null;
      }
      await this.pictures.markRemoved(id, {
        removal: "WITHDRAWN",
        removedById: actor.userId,
        removedAt: this.clock.now(),
      });
      await this.auditor.withdrawn(actor, current, request);
      return current;
    });
    if (removed !== null) {
      await this.store.deleteOfRow(removed, request.traceId);
      await this.store.sweep(SWEEP_AFTER_CHANGE, request);
    }
    return this.mine(actor);
  }

  private isTheirs(picture: PictureRecord, actor: PictureActor): boolean {
    if (picture.userId !== actor.userId) return false;
    // A rejected or removed picture is theirs too: withdrawing it changes nothing.
    return picture.status !== "PENDING"
      ? true
      : this.visibility.canSee(picture, actor, false);
  }

  private async noticeOf(
    actor: PictureActor,
    pending: PictureRecord | null,
    approved: PictureRecord | null,
  ): Promise<MyPicture["notice"]> {
    if (pending !== null) return null;
    const newest = await this.pictures.findNewestAdverseDecision(actor.userId);
    if (newest === null) return null;
    const { picture, kind } = newest;
    // In a demo session the decision on another session's picture is not this one's to read.
    if (
      picture.sessionFamilyId !== null &&
      picture.sessionFamilyId !== actor.sessionId
    ) {
      return null;
    }
    const decidedAt =
      kind === "REJECTED" ? picture.decidedAt : picture.removedAt;
    if (decidedAt === null) return null;
    if (approved?.decidedAt && approved.decidedAt > decidedAt) return null;
    return {
      kind,
      reasonCode: picture.reasonCode ?? "other",
      note: picture.reasonNote,
      decidedAt: decidedAt.toISOString(),
    };
  }
}

/** A demo session is counted by its own sign-in, not by the account every visitor of the role shares. */
export function familyOf(actor: PictureActor): string | null {
  return actor.demo ? actor.sessionId : null;
}
