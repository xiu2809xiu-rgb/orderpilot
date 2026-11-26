import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AuditActor, PictureRefusal } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import { RefusalSampler } from "./domain/refusal-sampler.js";
import { PictureClock } from "./picture-clock.js";
import type {
  PictureActor,
  PictureRecord,
  PictureRequest,
} from "./picture-types.js";

function actorOf(actor: PictureActor): AuditActor {
  return { kind: "user", userId: actor.userId, role: actor.role };
}

/** Flat scalars only: a hash, sizes and codes. Never the bytes, their base64 or a URL. */
function aiChanges(picture: PictureRecord): Record<string, unknown> {
  return {
    aiStatus: picture.aiStatus,
    aiWhy: picture.aiWhy,
    aiVerdict: picture.aiVerdict,
    aiConcerns: picture.aiConcerns.join(","),
  };
}

export interface UploadedFacts {
  readonly picture: PictureRecord;
  readonly receivedBytes: number;
  readonly strippedSegments: number;
  readonly trailingBytesCut: number;
  readonly replacedPictureId: string | null;
  readonly demoSession: boolean;
}

/**
 * Writes the audit rows of the picture routes, as the person who acted, on the
 * owner (entity type User, so a row appears in the owner's History in
 * Governance). The rows of a change join the caller's transaction. A refusal
 * changes nothing, so it is written outside any transaction and a failed write
 * is logged and never changes the answer.
 *
 * A key named `reason` would be shown masked to everyone but the auditor, so
 * the reason is `reasonCode`.
 */
@Injectable()
export class PictureAuditor {
  private readonly logger = new Logger(PictureAuditor.name);
  private readonly sampler = new RefusalSampler();

  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PictureClock) private readonly clock: PictureClock,
  ) {}

  async uploaded(
    actor: PictureActor,
    facts: UploadedFacts,
    request: PictureRequest,
  ): Promise<void> {
    const { picture } = facts;
    await this.audit.record({
      actor: actorOf(actor),
      action: "profile-picture.uploaded",
      entityType: "User",
      entityId: picture.userId,
      summary: `${actor.displayName} sent a profile picture for review`,
      changes: {
        pictureId: picture.id,
        byteSize: picture.byteSize,
        receivedBytes: facts.receivedBytes,
        sha256: picture.sha256,
        width: picture.width,
        progressive: picture.progressive,
        strippedSegments: facts.strippedSegments,
        trailingBytesCut: facts.trailingBytesCut,
        ...aiChanges(picture),
        replacedPictureId: facts.replacedPictureId ?? "",
        demoSession: facts.demoSession,
      },
      ip: request.ip,
      traceId: request.traceId,
    });
  }

  async withdrawn(
    actor: PictureActor,
    picture: PictureRecord,
    request: PictureRequest,
  ): Promise<void> {
    await this.audit.record({
      actor: actorOf(actor),
      action: "profile-picture.withdrawn",
      entityType: "User",
      entityId: picture.userId,
      summary: `${actor.displayName} removed their profile picture`,
      changes: { pictureId: picture.id, from: picture.status },
      ip: request.ip,
      traceId: request.traceId,
    });
  }

  async approved(
    actor: PictureActor,
    picture: PictureRecord,
    replacedPictureId: string | null,
    request: PictureRequest,
  ): Promise<void> {
    await this.audit.record({
      actor: actorOf(actor),
      action: "profile-picture.approved",
      entityType: "User",
      entityId: picture.userId,
      summary: `${actor.displayName} approved a profile picture`,
      changes: {
        pictureId: picture.id,
        sha256: picture.sha256,
        replacedPictureId: replacedPictureId ?? "",
      },
      ip: request.ip,
      traceId: request.traceId,
    });
  }

  async rejected(
    actor: PictureActor,
    picture: PictureRecord,
    decision: { reasonCode: string; note: string | null },
    request: PictureRequest,
  ): Promise<void> {
    await this.audit.record({
      actor: actorOf(actor),
      action: "profile-picture.rejected",
      entityType: "User",
      entityId: picture.userId,
      summary: `${actor.displayName} rejected a profile picture`,
      changes: {
        pictureId: picture.id,
        sha256: picture.sha256,
        reasonCode: decision.reasonCode,
        note: decision.note ?? "",
      },
      ip: request.ip,
      traceId: request.traceId,
    });
  }

  async takenDown(
    actor: PictureActor,
    picture: PictureRecord,
    decision: { reasonCode: string; note: string | null },
    request: PictureRequest,
  ): Promise<void> {
    await this.audit.record({
      actor: actorOf(actor),
      action: "profile-picture.taken-down",
      entityType: "User",
      entityId: picture.userId,
      summary: `${actor.displayName} took down a profile picture`,
      changes: {
        pictureId: picture.id,
        sha256: picture.sha256,
        reasonCode: decision.reasonCode,
        note: decision.note ?? "",
      },
      ip: request.ip,
      traceId: request.traceId,
    });
  }

  /**
   * An upload that was refused, for any reason. One row per person and reason
   * a minute, so sending 200 junk files cannot flood the audit chain.
   */
  async uploadRefused(
    actor: PictureActor,
    code: PictureRefusal,
    request: PictureRequest,
  ): Promise<void> {
    if (
      !this.sampler.shouldWrite(`${actor.userId}|${code}`, this.clock.now())
    ) {
      return;
    }
    await this.refused(actor, request, {
      action: "profile-picture.upload.refused",
      entityId: actor.userId,
      summary: `${actor.displayName} was refused sending a profile picture`,
      changes: { reasonCode: code, outcome: "refused" },
    });
  }

  async withdrawRefused(
    actor: PictureActor,
    pictureId: string,
    request: PictureRequest,
  ): Promise<void> {
    await this.refused(actor, request, {
      action: "profile-picture.withdraw.refused",
      entityId: actor.userId,
      summary: `${actor.displayName} was refused removing a picture that is not theirs`,
      changes: { pictureId, reasonCode: "not_found", outcome: "refused" },
    });
  }

  async reviewRefused(
    actor: PictureActor,
    picture: PictureRecord,
    attempted: "approve" | "reject" | "take_down",
    code: PictureRefusal,
    request: PictureRequest,
  ): Promise<void> {
    await this.refused(actor, request, {
      action: "profile-picture.review.refused",
      entityId: picture.userId,
      summary: `${actor.displayName} was refused a decision on a profile picture`,
      changes: {
        pictureId: picture.id,
        attempted,
        reasonCode: code,
        outcome: "refused",
      },
    });
  }

  /** Asking for a pending picture of someone else. Only a person who is signed in can, so it is audited each time. */
  async viewRefused(
    actor: PictureActor,
    picture: PictureRecord,
    request: PictureRequest,
  ): Promise<void> {
    await this.refused(actor, request, {
      action: "profile-picture.view.refused",
      entityId: picture.userId,
      summary: `${actor.displayName} was refused a pending profile picture`,
      changes: {
        pictureId: picture.id,
        reasonCode: "not_visible",
        outcome: "refused",
      },
    });
  }

  /** One row per object the sweep deleted, by the system. The decision it followed is already audited. */
  async objectSwept(
    picture: PictureRecord,
    request: PictureRequest,
  ): Promise<void> {
    try {
      await this.audit.record({
        actor: { kind: "system", name: "picture-sweep" },
        action: "profile-picture.object-swept",
        entityType: "User",
        entityId: picture.userId,
        summary:
          "A stored profile picture that was no longer needed was deleted",
        changes: { pictureId: picture.id },
        ip: null,
        traceId: request.traceId,
      });
    } catch (error) {
      this.logger.error(
        {
          traceId: request.traceId,
          errorName: error instanceof Error ? error.name : "NonError",
        },
        "Could not audit a swept picture",
      );
    }
  }

  private async refused(
    actor: PictureActor,
    request: PictureRequest,
    row: {
      action: string;
      entityId: string;
      summary: string;
      changes: Record<string, unknown>;
    },
  ): Promise<void> {
    try {
      await this.audit.record({
        actor: actorOf(actor),
        action: row.action,
        entityType: "User",
        entityId: row.entityId,
        summary: row.summary,
        changes: row.changes,
        ip: request.ip,
        traceId: request.traceId,
      });
    } catch (error) {
      this.logger.error(
        {
          traceId: request.traceId,
          errorName: error instanceof Error ? error.name : "NonError",
        },
        "Could not audit a picture refusal",
      );
    }
  }
}
