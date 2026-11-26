import { Inject, Injectable } from "@nestjs/common";
import type {
  PictureListQuery,
  PictureRefusal,
  ReviewItem,
} from "@orderpilot/shared";
import { NotFoundError } from "../../common/domain-error.js";
import type { Page } from "../../common/repository.js";
import { Database } from "../../database/database.js";
import { UserRepository } from "../../users/user.repository.js";
import { PictureRefusalError } from "./domain/picture-refusal.js";
import {
  PictureReviewRules,
  type ReviewAction,
} from "./domain/review-rules.js";
import { PictureAuditor } from "./picture-auditor.js";
import { PictureClock } from "./picture-clock.js";
import { PictureStore, SWEEP_AFTER_CHANGE } from "./picture-store.js";
import type {
  PictureActor,
  PictureRecord,
  PictureRequest,
} from "./picture-types.js";
import { ProfilePictureRepository } from "./profile-picture.repository.js";

/** A reviewer's reason and note for rejecting or taking down. */
export interface PictureDecision {
  readonly reasonCode: string;
  readonly note?: string | undefined;
}

type Outcome =
  | { readonly refused: PictureRefusal; readonly picture: PictureRecord }
  | {
      readonly picture: PictureRecord;
      /** Rows that left PENDING or APPROVED: their objects are deleted after the commit. */
      readonly retired: readonly PictureRecord[];
    };

/**
 * What a reviewer does: lists the pictures waiting or approved, approves,
 * rejects, takes down. Reviewing a picture is user administration, as
 * disabling a user is (ADR 0069): the person who does it still approves no
 * SPR, payment or bank detail. Each decision locks the owner's row, reads the
 * picture again under the lock, asks the rules, changes, and audits, in one
 * transaction, so two reviewers deciding at once take turns and the second is
 * refused with its reason. The decision names the picture in its path, so it
 * can never land on a picture the reviewer did not see. Objects are deleted
 * after the commit, and the sweep runs after it.
 */
@Injectable()
export class PictureReviewService {
  private readonly rules = new PictureReviewRules();

  constructor(
    @Inject(ProfilePictureRepository)
    private readonly pictures: ProfilePictureRepository,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(PictureStore) private readonly store: PictureStore,
    @Inject(PictureAuditor) private readonly auditor: PictureAuditor,
    @Inject(PictureClock) private readonly clock: PictureClock,
    @Inject(Database) private readonly database: Database,
  ) {}

  /** Oldest first, and never the caller's own pictures or a disabled person's. */
  async list(
    actor: PictureActor,
    query: PictureListQuery,
  ): Promise<Page<ReviewItem>> {
    const page = await this.pictures.list(query.status, query, actor.userId);
    const owners = await this.users.findRefsByIds([
      ...new Set(page.items.map((picture) => picture.userId)),
    ]);
    const items = page.items.flatMap((picture) => {
      const owner = owners.find((ref) => ref.id === picture.userId);
      return owner ? [toReviewItem(picture, owner)] : [];
    });
    return { items, meta: page.meta };
  }

  approve(
    actor: PictureActor,
    id: string,
    request: PictureRequest,
  ): Promise<ReviewItem> {
    return this.decide("approve", actor, id, request, async (current) => {
      const now = this.clock.now();
      const live = await this.pictures.findLiveByUser(current.userId);
      const earlier = live.find((picture) => picture.status === "APPROVED");
      // One approved picture per person: the earlier one steps aside first.
      if (earlier) {
        await this.pictures.markRemoved(earlier.id, {
          removal: "REPLACED_BY_APPROVAL",
          removedById: actor.userId,
          removedAt: now,
        });
      }
      await this.pictures.markApproved(current.id, actor.userId, now);
      await this.auditor.approved(actor, current, earlier?.id ?? null, request);
      return earlier ? [earlier] : [];
    });
  }

  reject(
    actor: PictureActor,
    id: string,
    decision: PictureDecision,
    request: PictureRequest,
  ): Promise<ReviewItem> {
    return this.decide("reject", actor, id, request, async (current) => {
      const note = decision.note ?? null;
      await this.pictures.markRejected(
        current.id,
        actor.userId,
        this.clock.now(),
        decision.reasonCode,
        note,
      );
      await this.auditor.rejected(
        actor,
        current,
        { reasonCode: decision.reasonCode, note },
        request,
      );
      return [current];
    });
  }

  takeDown(
    actor: PictureActor,
    id: string,
    decision: PictureDecision,
    request: PictureRequest,
  ): Promise<ReviewItem> {
    return this.decide("take_down", actor, id, request, async (current) => {
      const note = decision.note ?? null;
      await this.pictures.markRemoved(current.id, {
        removal: "TAKEN_DOWN",
        removedById: actor.userId,
        removedAt: this.clock.now(),
        reasonCode: decision.reasonCode,
        reasonNote: note,
      });
      await this.auditor.takenDown(
        actor,
        current,
        { reasonCode: decision.reasonCode, note },
        request,
      );
      return [current];
    });
  }

  private async decide(
    action: ReviewAction,
    actor: PictureActor,
    id: string,
    request: PictureRequest,
    change: (current: PictureRecord) => Promise<readonly PictureRecord[]>,
  ): Promise<ReviewItem> {
    const found = await this.pictures.findById(id);
    // A disabled person's pictures are not listed, so they are not found.
    if (found === null || found.ownerDisabled) {
      throw new NotFoundError("Picture");
    }

    const outcome = await this.database.transaction(
      async (): Promise<Outcome> => {
        await this.pictures.lockOwner(found.userId);
        const current = await this.pictures.findById(id);
        if (current === null) throw new NotFoundError("Picture");
        const judged = this.rules.judge(action, actor.userId, current);
        if (!judged.ok) return { refused: judged.code, picture: current };
        return { picture: current, retired: await change(current) };
      },
    );

    if ("refused" in outcome) {
      // Outside the transaction, so the record stays although nothing changed.
      await this.auditor.reviewRefused(
        actor,
        outcome.picture,
        action,
        outcome.refused,
        request,
      );
      throw new PictureRefusalError(outcome.refused);
    }
    for (const retired of outcome.retired) {
      await this.store.deleteOfRow(retired, request.traceId);
    }
    await this.store.sweep(SWEEP_AFTER_CHANGE, request);
    return this.itemOf(id);
  }

  private async itemOf(id: string): Promise<ReviewItem> {
    const picture = await this.pictures.findById(id);
    if (picture === null) throw new NotFoundError("Picture");
    const [owner] = await this.users.findRefsByIds([picture.userId]);
    if (owner === undefined) throw new NotFoundError("Picture");
    return toReviewItem(picture, owner);
  }
}

function toReviewItem(
  picture: PictureRecord,
  owner: ReviewItem["owner"],
): ReviewItem {
  return {
    id: picture.id,
    status: picture.status,
    createdAt: picture.createdAt.toISOString(),
    decidedAt: picture.decidedAt?.toISOString() ?? null,
    width: picture.width,
    byteSize: picture.byteSize,
    owner,
    ai: {
      status: picture.aiStatus,
      verdict: picture.aiVerdict,
      concerns: picture.aiConcerns,
      note: picture.aiNote,
      why: picture.aiWhy,
    },
  };
}
