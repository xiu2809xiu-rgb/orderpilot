import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  PROFILE_PICTURE_LIMITS,
  type MyPicture,
  type PictureRefusal,
} from "@orderpilot/shared";
import { Database } from "../../database/database.js";
import { JpegCleaner } from "./domain/jpeg-cleaner.js";
import { PictureRefusalError } from "./domain/picture-refusal.js";
import { UploadAllowance } from "./domain/upload-allowance.js";
import { PictureAuditor } from "./picture-auditor.js";
import { PictureCheckService } from "./picture-check.service.js";
import { PictureClock } from "./picture-clock.js";
import { PictureOwnerService, familyOf } from "./picture-owner.service.js";
import { PictureStore, SWEEP_AFTER_CHANGE } from "./picture-store.js";
import { PictureUploadGuard } from "./picture-upload-guard.js";
import type {
  PictureActor,
  PictureRecord,
  PictureRequest,
} from "./picture-types.js";
import { ProfilePictureRepository } from "./profile-picture.repository.js";

export interface UploadInput {
  readonly actor: PictureActor;
  /** The whole body, already read within the limit. Never an HTTP request. */
  readonly bytes: Buffer;
  readonly request: PictureRequest;
}

type Stored =
  | { readonly refused: PictureRefusal }
  | {
      readonly picture: PictureRecord;
      readonly replaced: PictureRecord | null;
    };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The upload use case (ADR 0069), in the order that spends the least first:
 * clean the bytes, refuse what is cheap to refuse (one upload in flight, the
 * cap, a file just rejected), ask the AI, write the object, then one
 * transaction that takes the owner's lock, checks the cap again, retires any
 * pending picture, inserts the new row and writes the audit row. The object
 * exists before its row, and is deleted again on every path where the row was
 * not stored. Every refusal is audited, sampled per person and reason.
 */
@Injectable()
export class PictureUploadService {
  private readonly cleaner = new JpegCleaner();
  private readonly allowance = new UploadAllowance();

  constructor(
    @Inject(ProfilePictureRepository)
    private readonly pictures: ProfilePictureRepository,
    @Inject(PictureStore) private readonly store: PictureStore,
    @Inject(PictureUploadGuard) private readonly guard: PictureUploadGuard,
    @Inject(PictureCheckService) private readonly check: PictureCheckService,
    @Inject(PictureAuditor) private readonly auditor: PictureAuditor,
    @Inject(PictureOwnerService) private readonly owner: PictureOwnerService,
    @Inject(PictureClock) private readonly clock: PictureClock,
    @Inject(Database) private readonly database: Database,
  ) {}

  /** A refusal found while reading the body (wrong type, too big, cut off): audited like every other. */
  refuseBody(
    actor: PictureActor,
    code: PictureRefusal,
    request: PictureRequest,
  ): Promise<void> {
    return this.auditor.uploadRefused(actor, code, request);
  }

  async upload(input: UploadInput): Promise<MyPicture> {
    const { actor, request } = input;
    const cleaned = this.cleaner.clean(input.bytes);
    if (!cleaned.ok) throw await this.refuse(actor, cleaned.code, request);
    const sha256 = createHash("sha256").update(cleaned.bytes).digest("hex");

    if (!(await this.guard.enter(actor.userId, request.traceId))) {
      throw await this.refuse(actor, "upload_busy", request);
    }
    try {
      const stored = await this.storeCleaned(input, cleaned, sha256);
      if ("refused" in stored)
        throw await this.refuse(actor, stored.refused, request);
      if (stored.replaced !== null) {
        await this.store.deleteOfRow(stored.replaced, request.traceId);
      }
      await this.store.sweep(SWEEP_AFTER_CHANGE, request);
    } finally {
      await this.guard.leave(actor.userId, request.traceId);
    }
    return this.owner.mine(actor);
  }

  private async storeCleaned(
    input: UploadInput,
    cleaned: Extract<ReturnType<JpegCleaner["clean"]>, { ok: true }>,
    sha256: string,
  ): Promise<Stored> {
    const { actor, request } = input;
    const now = this.clock.now();
    const family = familyOf(actor);

    // Cheap refusals first: nothing is stored or sent anywhere yet.
    if (await this.overCap(actor, now, family))
      return { refused: "upload_limit" };
    const since = new Date(
      now.getTime() - PROFILE_PICTURE_LIMITS.rejectedRepeatDays * DAY_MS,
    );
    if (await this.pictures.hasRefusedBefore(actor.userId, sha256, since)) {
      return { refused: "rejected_before" };
    }

    // Outside any transaction: the gateway refuses to run inside one.
    const checked = await this.check.check(
      cleaned.bytes,
      actor,
      request.traceId,
    );
    const key = this.store.newKey(actor.userId);
    await this.store.put(key, cleaned.bytes);

    let stored: Stored;
    try {
      stored = await this.database.transaction(async () => {
        await this.pictures.lockOwner(actor.userId);
        // The cap again, on the truth: Redis may have been down, or a second process raced.
        if (await this.overCap(actor, now, family)) {
          return { refused: "upload_limit" } as const;
        }
        const live = await this.pictures.findLiveByUser(actor.userId);
        const replaced = live.find((p) => p.status === "PENDING") ?? null;
        if (replaced !== null) {
          await this.pictures.markRemoved(replaced.id, {
            removal: "REPLACED_BY_UPLOAD",
            removedById: actor.userId,
            removedAt: now,
          });
        }
        const picture = await this.pictures.insertPending({
          userId: actor.userId,
          objectKey: key,
          byteSize: cleaned.bytes.length,
          sha256,
          width: cleaned.width,
          progressive: cleaned.progressive,
          ...checked,
          createdAt: now,
          sessionFamilyId: family,
        });
        await this.auditor.uploaded(
          actor,
          {
            picture,
            receivedBytes: input.bytes.length,
            strippedSegments: cleaned.strippedSegments,
            trailingBytesCut: cleaned.trailingBytesCut,
            replacedPictureId: replaced?.id ?? null,
            demoSession: actor.demo,
          },
          request,
        );
        return { picture, replaced };
      });
    } catch (error) {
      await this.store.deleteKeyQuietly(key, request.traceId);
      throw error;
    }
    // A throw is not the only way the row is missing: the cap can refuse under the lock.
    if ("refused" in stored) {
      await this.store.deleteKeyQuietly(key, request.traceId);
    }
    return stored;
  }

  private async overCap(
    actor: PictureActor,
    now: Date,
    family: string | null,
  ): Promise<boolean> {
    const used = await this.pictures.countSince(
      actor.userId,
      this.allowance.windowStart(now),
      family,
    );
    return !this.allowance.judge(used, PROFILE_PICTURE_LIMITS.uploadsPer24Hours)
      .ok;
  }

  /** Audits a refusal outside any transaction, then returns the error to throw. */
  private async refuse(
    actor: PictureActor,
    code: PictureRefusal,
    request: PictureRequest,
  ): Promise<PictureRefusalError> {
    await this.auditor.uploadRefused(actor, code, request);
    return new PictureRefusalError(code);
  }
}
