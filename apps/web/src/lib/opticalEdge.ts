import type { CSSProperties } from "react";

/**
 * The side space a large heading carries before its first letter, in
 * thousandths of an em, measured from the outlines of Geist at weight 600 (the
 * weight of the page title). A stem letter such as N or M starts 2.2 px inside
 * its box at 28 px, a round one such as O or G 1.2 px, a diagonal one such as
 * A or T under 0.6 px, so no single offset fits every title: each heading is
 * pulled left by its own first letter's space and its ink meets the card edge
 * below it. `opticalEdge.test.ts` reads the font file and checks every value.
 */
export const LEFT_SIDE_BEARING_600: Readonly<Record<string, number>> = {
  A: 19,
  B: 80,
  C: 43,
  D: 80,
  E: 80,
  F: 80,
  G: 43,
  H: 80,
  I: 80,
  J: 55,
  K: 80,
  L: 80,
  M: 80,
  N: 80,
  O: 43,
  P: 80,
  Q: 43,
  R: 80,
  S: 53,
  T: 11,
  U: 65,
  V: 19,
  W: 37,
  X: 13,
  Y: -7,
  Z: 27,
  "0": 46,
  "1": 38,
  "2": 59,
  "3": 46,
  "4": 26,
  "5": 57,
  "6": 46,
  "7": 20,
  "8": 36,
  "9": 36,
};

/**
 * The inset of a heading's first character, as a CSS length in em that is
 * zero or negative. A first character that is not a capital or a digit (a
 * lowercase letter, a quote) gets no correction: its space is not measured.
 */
export function opticalInset(text: string): string {
  const first = text.trimStart().charAt(0);
  const bearing = LEFT_SIDE_BEARING_600[first];
  if (bearing === undefined) return "0em";
  // Written without a trailing zero or a negative zero: "-0.08em", "0.007em".
  return `${(-bearing / 1000).toString()}em`;
}

/**
 * The style that makes `.optical-start` (styles/optical.css) pull the heading
 * left by its first letter's side space. Set it on the heading itself.
 */
export function opticalStyle(text: string): CSSProperties {
  return { ["--optical-inset" as string]: opticalInset(text) };
}
