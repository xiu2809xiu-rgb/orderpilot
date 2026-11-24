import type {
  PictureAiStatus,
  PictureAiVerdict,
  PictureConcern,
  PictureStatus,
  Role,
} from "@orderpilot/shared";
import type { PictureRemoval } from "./domain/review-rules.js";

/** A stored picture as the services see it. Never the bytes: those live in the object store. */
export interface PictureRecord {
  readonly id: string;
  readonly userId: string;
  readonly status: PictureStatus;
  readonly removal: PictureRemoval | null;
  readonly objectKey: string;
  readonly objectDeletedAt: Date | null;
  readonly byteSize: number;
  readonly sha256: string;
  readonly width: number;
  readonly progressive: boolean;
  readonly aiStatus: PictureAiStatus;
  readonly aiWhy: string | null;
  readonly aiVerdict: PictureAiVerdict | null;
  readonly aiConcerns: PictureConcern[];
  readonly aiNote: string | null;
  readonly createdAt: Date;
  readonly sessionFamilyId: string | null;
  readonly decidedById: string | null;
  readonly decidedAt: Date | null;
  readonly reasonCode: string | null;
  readonly reasonNote: string | null;
  readonly removedAt: Date | null;
  readonly removedById: string | null;
  /** The owner's account is switched off: nobody sees or reviews the picture. */
  readonly ownerDisabled: boolean;
}

/** What a new pending row is made of. */
export interface NewPicture {
  readonly userId: string;
  readonly objectKey: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly width: number;
  readonly progressive: boolean;
  readonly aiStatus: PictureAiStatus;
  readonly aiWhy: string | null;
  readonly aiVerdict: PictureAiVerdict | null;
  readonly aiConcerns: readonly PictureConcern[];
  readonly aiNote: string | null;
  readonly createdAt: Date;
  readonly sessionFamilyId: string | null;
}

/** The signed-in person behind a picture request. */
export interface PictureActor {
  readonly userId: string;
  readonly role: Role;
  readonly displayName: string;
  /** True for the one-click demo sign-in: every visitor of a role is one account. */
  readonly demo: boolean;
  /** The sign-in's family (AuthContext.sessionId). */
  readonly sessionId: string;
}

/** Where a request came from, for the audit row. */
export interface PictureRequest {
  readonly ip: string | null;
  readonly traceId: string;
}
