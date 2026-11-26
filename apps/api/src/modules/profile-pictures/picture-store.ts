import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ObjectStorage } from "../../storage/object-storage.js";
import { PictureAuditor } from "./picture-auditor.js";
import { PictureClock } from "./picture-clock.js";
import type { PictureRecord, PictureRequest } from "./picture-types.js";
import { ProfilePictureRepository } from "./profile-picture.repository.js";

const SWEEP_AT_START = 100;
/** After each upload, review decision or withdrawal: enough to catch leftovers, small enough not to hold the request. */
export const SWEEP_AFTER_CHANGE = 20;

/**
 * Writes, reads and deletes picture objects through ObjectStorage. An object
 * is deleted after the transaction that retired its row commits, never inside
 * it (a rollback would then destroy a live picture), and a failed delete
 * leaves the row's `objectDeletedAt` empty so that the sweep retries it.
 */
@Injectable()
export class PictureStore {
  private readonly logger = new Logger(PictureStore.name);

  constructor(
    @Inject(ObjectStorage) private readonly storage: ObjectStorage,
    @Inject(ProfilePictureRepository)
    private readonly pictures: ProfilePictureRepository,
    @Inject(PictureAuditor) private readonly auditor: PictureAuditor,
    @Inject(PictureClock) private readonly clock: PictureClock,
  ) {}

  /** A new key for one stored picture: never reused, so the bytes at a key never change. */
  newKey(userId: string): string {
    return `profile-pictures/${userId}/${randomUUID()}.jpg`;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    await this.storage.put(key, bytes, { contentType: "image/jpeg" });
  }

  /** The bytes, or null when the object is missing. */
  async read(key: string): Promise<Buffer | null> {
    const stored = await this.storage.get(key);
    return stored ? stored.body : null;
  }

  /** Deletes an object that has no row, such as the new one of an upload whose row was not stored. */
  async deleteKeyQuietly(key: string, traceId: string): Promise<boolean> {
    try {
      await this.storage.delete(key);
      return true;
    } catch (error) {
      this.logFailure(error, traceId);
      return false;
    }
  }

  /** Deletes the object of a row that left PENDING or APPROVED and marks the row. A failure waits for the sweep. */
  async deleteOfRow(
    picture: Pick<PictureRecord, "id" | "objectKey">,
    traceId: string,
  ): Promise<boolean> {
    try {
      await this.storage.delete(picture.objectKey);
      await this.pictures.markObjectDeleted(picture.id, this.clock.now());
      return true;
    } catch (error) {
      this.logFailure(error, traceId);
      return false;
    }
  }

  /**
   * Retries the objects that are still to be deleted, oldest first, and writes
   * one audit row for each it deletes. A failure is logged and leaves the row
   * for the next sweep.
   */
  async sweep(limit: number, request: PictureRequest): Promise<number> {
    let swept = 0;
    try {
      for (const picture of await this.pictures.findUndeleted(limit)) {
        if (await this.deleteOfRow(picture, request.traceId)) {
          swept += 1;
          await this.auditor.objectSwept(picture, request);
        }
      }
    } catch (error) {
      this.logFailure(error, request.traceId);
    }
    return swept;
  }

  /** At start-up, with a wider limit than after a change. */
  sweepAtStart(): Promise<number> {
    return this.sweep(SWEEP_AT_START, { ip: null, traceId: "picture-sweep" });
  }

  private logFailure(error: unknown, traceId: string): void {
    // The class only: a message could quote a key or a response.
    this.logger.error(
      {
        traceId,
        errorName: error instanceof Error ? error.name : "NonError",
      },
      "A picture object could not be deleted; the sweep will try again",
    );
  }
}
