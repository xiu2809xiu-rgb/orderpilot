import { createHash, randomBytes } from "node:crypto";

/** The value of the op_two_step cookie: 256 random bits, opaque, safe in a cookie. */
export function newChallengeToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this is stored, as for a refresh token: a leaked table cannot be replayed as cookies. */
export function hashChallengeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
