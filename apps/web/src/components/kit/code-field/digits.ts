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

/**
 * What the input holds after a keystroke. A digit typed into the middle of a
 * full code makes the browser insert it, which would push the last digit out
 * and give a code nobody typed; it replaces the digit under the caret
 * instead. Typing after the sixth digit, a letter, an autofill and anything
 * that is not one inserted character are left as they came.
 */
export function typedOver(
  value: string,
  raw: string,
  caret: number | null,
): string {
  if (value.length !== CODE_LENGTH || raw.length !== value.length + 1) {
    return raw;
  }
  if (caret === null || caret < 1 || caret > value.length) return raw;
  const typed = raw.charAt(caret - 1);
  const without = raw.slice(0, caret - 1) + raw.slice(caret);
  if (!/^\d$/.test(typed) || without !== value) return raw;
  return value.slice(0, caret - 1) + typed + value.slice(caret);
}
