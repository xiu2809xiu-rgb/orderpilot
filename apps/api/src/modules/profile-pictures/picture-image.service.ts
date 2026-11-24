import { Inject, Injectable, Logger } from "@nestjs/common";
import { NotFoundError } from "../../common/domain-error.js";
import { etagMatches, etagOf } from "./domain/etag.js";
import { PictureVisibility } from "./domain/picture-visibility.js";
import { PictureAuditor } from "./picture-auditor.js";
import { PictureReviewers } from "./picture-reviewers.js";
import { PictureStore } from "./picture-store.js";
import type { PictureActor, PictureRequest } from "./picture-types.js";
import { ProfilePictureRepository } from "./profile-picture.repository.js";

export type ServedPicture =
  | { readonly kind: "bytes"; readonly etag: string; readonly bytes: Buffer }
  | { readonly kind: "not-modified"; readonly etag: string };

/**
 * The bytes of one picture, for the people allowed to see it. The visibility
 * rule is asked first, so a picture that is not visible, taken down, or whose
 * owner is disabled is a 404 whatever the caller already holds: an
 * If-None-Match is answered 304 only for a picture that is still visible.
 * A live row whose stored object is missing is a 404 too, never a 500.
 */
@Injectable()
export class PictureImageService {
  private readonly logger = new Logger(PictureImageService.name);
  private readonly visibility = new PictureVisibility();

  constructor(
    @Inject(ProfilePictureRepository)
    private readonly pictures: ProfilePictureRepository,
    @Inject(PictureReviewers) private readonly reviewers: PictureReviewers,
    @Inject(PictureStore) private readonly store: PictureStore,
    @Inject(PictureAuditor) private readonly auditor: PictureAuditor,
  ) {}

  async serve(
    actor: PictureActor,
    id: string,
    ifNoneMatch: string | undefined,
    request: PictureRequest,
  ): Promise<ServedPicture> {
    const picture = await this.pictures.findById(id);
    if (picture === null) throw new NotFoundError("Picture");
    const isReviewer = await this.reviewers.isReviewer(actor);
    if (!this.visibility.canSee(picture, actor, isReviewer)) {
      // Someone asking for a pending picture of another person. Only a signed-in
      // person can, so it is audited each time.
      if (
        picture.status === "PENDING" &&
        picture.userId !== actor.userId &&
        !picture.ownerDisabled
      ) {
        await this.auditor.viewRefused(actor, picture, request);
      }
      throw new NotFoundError("Picture");
    }
    const etag = etagOf(picture.sha256);
    if (etagMatches(ifNoneMatch, etag)) return { kind: "not-modified", etag };
    const bytes = await this.store.read(picture.objectKey);
    if (bytes === null) {
      this.logger.error(
        { traceId: request.traceId, errorName: "MissingPictureObject" },
        "A live profile picture has no stored object",
      );
      throw new NotFoundError("Picture");
    }
    return { kind: "bytes", etag, bytes };
  }
}
