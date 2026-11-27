import { createHash, randomBytes } from "node:crypto";

/** No I, O, 0 or 1: they are read wrongly from paper. 32 symbols, so 5 bits each. */
export const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SYMBOLS = 15;
const GROUP = 5;

/**
 * Makes `count` recovery codes of 15 symbols, 75 random bits each. 256 is a
 * multiple of 32, so taking the low five bits of a random byte is not biased.
 */
export function generateRecoveryCodes(
  count: number,
  random: (size: number) => Buffer = randomBytes,
): string[] {
  return Array.from({ length: count }, () => {
    const bytes = random(SYMBOLS);
    return Array.from(bytes, (byte) =>
      RECOVERY_ALPHABET.charAt(byte & 31),
    ).join("");
  });
}

/** `ABCDEFGHJKLMNPQ` as `ABCDE-FGHJK-LMNPQ`, the way a person copies it. */
export function formatRecoveryCode(code: string): string {
  const groups: string[] = [];
  for (let at = 0; at < code.length; at += GROUP) {
    groups.push(code.slice(at, at + GROUP));
  }
  return groups.join("-");
}

/** Case, spaces and hyphens do not matter. Null for a wrong length or a symbol outside the alphabet. */
export function normaliseRecoveryCode(input: string): string | null {
  const clean = input.toUpperCase().replaceAll(/[\s-]/g, "");
  if (clean.length !== SYMBOLS) return null;
  for (const char of clean) {
    if (!RECOVERY_ALPHABET.includes(char)) return null;
  }
  return clean;
}

/**
 * Plain SHA-256, as for a refresh token: 75 random bits cannot be searched
 * from a leaked table, and a keyed hash would die with JWT_SECRET, which is
 * exactly when a recovery code is the way back in.
 */
export function hashRecoveryCode(normalised: string): string {
  return createHash("sha256").update(normalised).digest("hex");
}
