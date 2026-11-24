import { Inject, Injectable } from "@nestjs/common";
import {
  pictureConcernSchema,
  type PictureConcern,
  type PictureListStatus,
  type PageQuery,
} from "@orderpilot/shared";
import type { Page } from "../../common/repository.js";
import { Database } from "../../database/database.js";
import type {
  Prisma,
  ProfilePicture as PictureRow,
} from "../../generated/prisma/client.js";
import type { PictureRemoval } from "./domain/review-rules.js";
import type { NewPicture, PictureRecord } from "./picture-types.js";

type RowWithOwner = PictureRow & { user: { disabledAt: Date | null } };

const WITH_OWNER = { user: { select: { disabledAt: true } } } as const;

/** A disabled person's pictures are left alone, not deleted, and shown to nobody (ADR 0068). */
const OWNER_ENABLED = { user: { disabledAt: null } } as const;

export interface Removal {
  readonly removal: PictureRemoval;
  readonly removedById: string;
  readonly removedAt: Date;
  readonly reasonCode?: string;
  readonly reasonNote?: string | null;
}

/**
 * The only place the ProfilePicture table is read or written. Every time is an
 * argument, so a test passes one fixed moment. The database holds the two
 * one-per-person rules as partial unique indexes, and `lockOwner` makes one
 * person's changes take turns, so the rules are also checked on the truth
 * before a row is written.
 */
@Injectable()
export class ProfilePictureRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /**
   * Locks the person's User row until the transaction ends, so an upload, a
   * withdrawal and every review decision about one person take turns. Call it
   * inside a transaction.
   */
  async lockOwner(userId: string): Promise<void> {
    await this.database.client
      .$queryRaw`SELECT id FROM "User" WHERE id = ${userId}::uuid FOR UPDATE`;
  }

  async findById(id: string): Promise<PictureRecord | null> {
    const row = await this.database.client.profilePicture.findUnique({
      where: { id },
      include: WITH_OWNER,
    });
    return row ? toRecord(row) : null;
  }

  /** The person's PENDING and APPROVED rows: at most one of each. */
  async findLiveByUser(userId: string): Promise<PictureRecord[]> {
    const rows = await this.database.client.profilePicture.findMany({
      where: { userId, status: { in: ["PENDING", "APPROVED"] } },
      include: WITH_OWNER,
    });
    return rows.map(toRecord);
  }

  /**
   * The newest decision against the person's pictures: a rejection or a
   * take-down. Two small reads, because a take-down is dated by `removedAt`
   * and a rejection by `decidedAt`.
   */
  async findNewestAdverseDecision(userId: string): Promise<{
    kind: "REJECTED" | "TAKEN_DOWN";
    picture: PictureRecord;
  } | null> {
    const [rejected, takenDown] = await Promise.all([
      this.database.client.profilePicture.findFirst({
        where: { userId, status: "REJECTED" },
        orderBy: [{ decidedAt: "desc" }, { id: "desc" }],
        include: WITH_OWNER,
      }),
      this.database.client.profilePicture.findFirst({
        where: { userId, status: "REMOVED", removal: "TAKEN_DOWN" },
        orderBy: [{ removedAt: "desc" }, { id: "desc" }],
        include: WITH_OWNER,
      }),
    ]);
    const rejectedAt = rejected?.decidedAt?.getTime() ?? -1;
    const takenDownAt = takenDown?.removedAt?.getTime() ?? -1;
    if (rejected && rejectedAt >= takenDownAt) {
      return { kind: "REJECTED", picture: toRecord(rejected) };
    }
    return takenDown
      ? { kind: "TAKEN_DOWN", picture: toRecord(takenDown) }
      : null;
  }

  /**
   * Stored uploads since a moment (rows created strictly after it), whatever
   * became of them. A demo session is counted by its own sign-in, not by the
   * account every visitor of the role shares.
   */
  countSince(
    userId: string,
    since: Date,
    sessionFamilyId: string | null,
  ): Promise<number> {
    return this.database.client.profilePicture.count({
      where: {
        userId,
        createdAt: { gt: since },
        ...(sessionFamilyId === null ? {} : { sessionFamilyId }),
      },
    });
  }

  /** True when the person had this exact picture rejected, or taken down, since a moment. */
  async hasRefusedBefore(
    userId: string,
    sha256: string,
    since: Date,
  ): Promise<boolean> {
    const found = await this.database.client.profilePicture.findFirst({
      where: {
        userId,
        sha256,
        OR: [
          { status: "REJECTED", decidedAt: { gte: since } },
          {
            status: "REMOVED",
            removal: "TAKEN_DOWN",
            removedAt: { gte: since },
          },
        ],
      },
      select: { id: true },
    });
    return found !== null;
  }

  async insertPending(picture: NewPicture): Promise<PictureRecord> {
    const row = await this.database.client.profilePicture.create({
      data: {
        userId: picture.userId,
        objectKey: picture.objectKey,
        byteSize: picture.byteSize,
        sha256: picture.sha256,
        width: picture.width,
        progressive: picture.progressive,
        aiStatus: picture.aiStatus,
        aiWhy: picture.aiWhy,
        aiVerdict: picture.aiVerdict,
        aiConcerns: [...picture.aiConcerns],
        aiNote: picture.aiNote,
        createdAt: picture.createdAt,
        sessionFamilyId: picture.sessionFamilyId,
      },
      include: WITH_OWNER,
    });
    return toRecord(row);
  }

  async markRemoved(id: string, removal: Removal): Promise<void> {
    await this.database.client.profilePicture.update({
      where: { id },
      data: {
        status: "REMOVED",
        removal: removal.removal,
        removedById: removal.removedById,
        removedAt: removal.removedAt,
        ...(removal.reasonCode === undefined
          ? {}
          : {
              reasonCode: removal.reasonCode,
              reasonNote: removal.reasonNote ?? null,
            }),
      },
    });
  }

  async markApproved(id: string, byId: string, at: Date): Promise<void> {
    await this.database.client.profilePicture.update({
      where: { id },
      data: { status: "APPROVED", decidedById: byId, decidedAt: at },
    });
  }

  async markRejected(
    id: string,
    byId: string,
    at: Date,
    reasonCode: string,
    reasonNote: string | null,
  ): Promise<void> {
    await this.database.client.profilePicture.update({
      where: { id },
      data: {
        status: "REJECTED",
        decidedById: byId,
        decidedAt: at,
        reasonCode,
        reasonNote,
      },
    });
  }

  /**
   * A page of one status, oldest first. It never holds the caller's own
   * pictures or a disabled person's, so a count of it is only what the caller
   * can act on.
   */
  async list(
    status: PictureListStatus,
    query: PageQuery,
    excludeUserId: string,
  ): Promise<Page<PictureRecord>> {
    const where: Prisma.ProfilePictureWhereInput = {
      status,
      userId: { not: excludeUserId },
      ...OWNER_ENABLED,
    };
    const [rows, total] = await Promise.all([
      this.database.client.profilePicture.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: WITH_OWNER,
      }),
      this.database.client.profilePicture.count({ where }),
    ]);
    return {
      items: rows.map(toRecord),
      meta: { page: query.page, pageSize: query.pageSize, total },
    };
  }

  /** Rejected or removed rows whose stored object is still to be deleted, oldest first. */
  async findUndeleted(limit: number): Promise<PictureRecord[]> {
    const rows = await this.database.client.profilePicture.findMany({
      where: {
        objectDeletedAt: null,
        status: { in: ["REJECTED", "REMOVED"] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
      include: WITH_OWNER,
    });
    return rows.map(toRecord);
  }

  async markObjectDeleted(id: string, at: Date): Promise<void> {
    await this.database.client.profilePicture.update({
      where: { id },
      data: { objectDeletedAt: at },
    });
  }
}

function concernsOf(values: readonly string[]): PictureConcern[] {
  return values.flatMap((value) => {
    const parsed = pictureConcernSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}

function toRecord(row: RowWithOwner): PictureRecord {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    removal: row.removal,
    objectKey: row.objectKey,
    objectDeletedAt: row.objectDeletedAt,
    byteSize: row.byteSize,
    sha256: row.sha256,
    width: row.width,
    progressive: row.progressive,
    aiStatus: row.aiStatus,
    aiWhy: row.aiWhy,
    aiVerdict: row.aiVerdict,
    aiConcerns: concernsOf(row.aiConcerns),
    aiNote: row.aiNote,
    createdAt: row.createdAt,
    sessionFamilyId: row.sessionFamilyId,
    decidedById: row.decidedById,
    decidedAt: row.decidedAt,
    reasonCode: row.reasonCode,
    reasonNote: row.reasonNote,
    removedAt: row.removedAt,
    removedById: row.removedById,
    ownerDisabled: row.user.disabledAt !== null,
  };
}
