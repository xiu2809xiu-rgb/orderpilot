/** What presenting a sign-in challenge means. */
export type ChallengeVerdict =
  | "ok"
  /** No such challenge: forged, already finished or from a reset database. */
  | "unknown"
  | "expired";

/** Pure, as judgeRefreshToken is: time is an argument. */
export function judgeChallenge(
  challenge: { readonly expiresAt: Date } | null,
  now: Date,
): ChallengeVerdict {
  if (challenge === null) return "unknown";
  return challenge.expiresAt.getTime() <= now.getTime() ? "expired" : "ok";
}
