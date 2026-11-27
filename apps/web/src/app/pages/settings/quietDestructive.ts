/**
 * An outline in the destructive tokens, for what ends or undoes something
 * (Sign out, Reset): the border and the words are the destructive colour, and
 * the hover fills with the destructive surface. The resting fill is the page
 * ground in both themes: the outline variant's own dark fill is a 30% wash
 * over the translucent card, which on the brightest part of the aurora gave
 * the words 3.75:1. `SessionCard.contrast.test.ts` reads the words against
 * that fill and the hover fill. The dark rules are repeated because the
 * outline variant sets its own for dark.
 */
export const QUIET_DESTRUCTIVE =
  "border-destructive text-destructive hover:bg-(--destructive-surface) hover:text-destructive dark:border-destructive dark:bg-background dark:hover:bg-(--destructive-surface)";
