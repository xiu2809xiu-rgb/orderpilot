import { createHash, randomBytes } from "node:crypto";

/** A fresh refresh token: 256 random bits, safe to put in a cookie. */
export function newRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only this is stored. A leaked table cannot be replayed as cookies. */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
