import type { RefreshTokenRecord } from "../../sessions/refresh-token.repository.js";

/** What presenting a refresh token means. */
export type RefreshVerdict =
  | "ok"
  /** No such token: forged, or from a database that was reset. */
  | "unknown"
  /** Already exchanged once. Whoever presents it now may be a thief. */
  | "reused"
  /** Ended by sign-out, by disabling the user or by an earlier reuse. */
  | "revoked"
  | "expired";

/**
 * Pure: the order of the checks is the rule. A used token is a reuse even if
 * it has expired since, and a revoked family stays revoked.
 */
export function judgeRefreshToken(
  token: Pick<RefreshTokenRecord, "usedAt" | "revokedAt" | "expiresAt"> | null,
  now: Date,
): RefreshVerdict {
  if (token === null) return "unknown";
  if (token.usedAt !== null) {
    // A token that was revoked after its use belongs to a family that is
    // already dead: do not report a second reuse for it.
    return token.revokedAt === null ? "reused" : "revoked";
  }
  if (token.revokedAt !== null) return "revoked";
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  return "ok";
}
