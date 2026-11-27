/**
 * The field's timings. The bundle this field comes from imported its own
 * constants from a file it did not ship, so these are chosen here. A number
 * that names a design token is read from tokens.css by codeFieldMotion.test.ts
 * and must equal it; the CSS (codeField.css) uses the tokens by name, so the
 * milliseconds below are for the tests, the spring and the parent's timers.
 *
 * UI motion stays between 150 and 250 ms (CLAUDE.md section 8). The three
 * holds are timers, not motion.
 */
export const codeFieldMotion = {
  /** On mount, the shell unfolds from the pill to full width and the cells fade in (--motion-slow). */
  revealMs: 250,
  /** A new digit rises into its cell (--motion-fast). */
  digitRiseMs: 160,
  /** The focus ring moves to the next cell by a spring (--spring-stiffness, --spring-damping). */
  ringSpring: { stiffness: 260, damping: 28 },
  /** The cells fade and the shell folds to the pill (--motion-base). */
  collapseMs: 220,
  /** The shell shakes once for a wrong code (inside the 150 to 250 band). */
  shakeMs: 240,
  /** The green state fills in (--motion-slow). */
  successMs: 250,
  /** One turn of the spinner, linear, for as long as it verifies. A loop, not a transition. */
  spinnerMs: 750,
  /** "Verifying" stays at least this long, so a quick server does not flash it. A parent timer. */
  verifyingMinMs: 500,
  /** The red cells stay this long, then the parent clears the value. A parent timer. */
  errorHoldMs: 900,
  /** The green "Verified" stays this long before the parent goes on. A parent timer. */
  successHoldMs: 700,
} as const;

/** The pill's width: the shell's width while it verifies, and where the unfold starts. */
export const CODE_FIELD_PILL = "11rem";

/** The field's height in CSS px: one touch target, over the 44 px a finger needs. */
export const CODE_FIELD_HEIGHT_PX = 56;

/** The number of cells, and of digits in a code. */
export const CODE_LENGTH = 6;
