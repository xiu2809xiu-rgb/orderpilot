import { CODE_LENGTH } from "./codeFieldMotion";

/** Digits only, the first six: what typing, pasting and an autofill all reduce to. */
export function sanitizeDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

/**
 * The cell the caret is in: the number of digits before it, with the last
 * cell as the limit. A caret after the sixth digit still rests on the sixth cell.
 */
export function activeCell(raw: string, caret: number | null): number {
  const before = caret === null ? raw : raw.slice(0, caret);
  return Math.min(sanitizeDigits(before).length, CODE_LENGTH - 1);
}

/** The cell under a pointer, never past the first empty cell. */
export function cellAtPoint(
  x: number,
  left: number,
  width: number,
  filled: number,
): number {
  if (width <= 0) return Math.min(filled, CODE_LENGTH - 1);
  const raw = Math.floor(((x - left) / width) * CODE_LENGTH);
  return Math.max(0, Math.min(raw, filled, CODE_LENGTH - 1));
}
