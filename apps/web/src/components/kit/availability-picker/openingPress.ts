/**
 * What counts as a pick with a pointer, in one model.
 *
 * The pill grows over its trigger, so the rest of the gesture that opened it
 * (the second click of a double click, the click that a finger's tap sends
 * after its release) lands on a choice that nobody chose. Two things kept
 * here, in a module, tell them apart: a clock that starts each time the menu
 * opens (however it was opened and whether or not Radix kept the pill mounted
 * through a fold), with a number for each opening, and the pointer press that
 * opened it, with its place.
 *
 * - A press on a choice is refused in the first 250 ms of the clock
 *   (OPEN_GUARD_MS), and when it repeats the opening press: within 500 ms of
 *   it (REPEAT_WINDOW_MS) and within a few px of its place. The 500 ms is a
 *   fixed number, the usual double-click time; it does not read the system's
 *   setting, which can be longer, and a slower double click picks. A repeat
 *   restarts the 500 ms, so a burst of clicks at one place is one gesture and
 *   a triple click picks nothing either. But only for the first second after
 *   the opening (OPENING_CLICK_MS): the gesture that opened the menu lasts one
 *   second at most, and a person who keeps clicking because nothing seems to
 *   happen gets their pick as soon as that second is over, wherever it lands.
 * - A refused press stays refused: its release and the click that belongs to
 *   it pick nothing, however long the button was held.
 * - What a choice keeps of a press (that it may pick, or that it was refused)
 *   counts only in the opening it was made in: each opening has a number, and
 *   a mark from another opening is read as no press. A pick closes the menu,
 *   which ends its opening, so a pick needs no clearing of its own. Radix
 *   keeps the pill mounted when the menu closes and opens again within the
 *   fold, and a press that was slid away from and never finished must not
 *   make the next click of that choice look like one that was pressed.
 * - A click made by a pointer (its `detail` is 1 or more) on a choice that was
 *   not pressed is the click of the tap that opened the pill, and is refused
 *   in the first second of the clock (OPENING_CLICK_MS). After that an input
 *   that sends a click with no press of its own (a mobile screen reader) picks.
 * - A release never picks. A pick is the browser's click on the choice, or the
 *   keyboard's; a held key picks nothing (the choice and the trigger ignore a
 *   repeated Enter or Space).
 *
 * A person who chooses has moved the pointer or has waited; a person who
 * repeats the click has done neither. The press expires by its own time, so a
 * pill opened later by the keyboard, or from a button that is not the
 * trigger, is never held back by an old press.
 */
export const OPEN_GUARD_MS = 250;
export const REPEAT_WINDOW_MS = 500;
export const OPENING_CLICK_MS = 1000;
/** How far a repeat may land from the opening press: a finger never lands on the same pixel twice. */
export const REPEAT_REACH_PX = { pointer: 8, touch: 24 } as const;

interface Press {
  readonly x: number;
  readonly y: number;
  readonly reach: number;
  /** When it was made, or when a repeat of it last was. */
  at: number;
}
interface PressPoint {
  clientX: number;
  clientY: number;
  pointerType?: string;
}

let opening: Press | null = null;
let openedAt: number | null = null;
let openingCount = 0;

/** The control calls this each time its menu opens, whoever opened it. */
export function markOpened(): void {
  openedAt = performance.now();
  openingCount += 1;
}

/** Which opening this is: a choice keeps it with its mark, and a mark of another opening is void. */
export function openingNumber(): number {
  return openingCount;
}

/** Milliseconds since the menu last opened; none has opened, none has passed. */
export function msSinceOpened(): number {
  return openedAt === null ? Infinity : performance.now() - openedAt;
}

export function recordOpeningPress(event: PressPoint): void {
  opening = {
    x: event.clientX,
    y: event.clientY,
    at: performance.now(),
    reach:
      event.pointerType === "touch"
        ? REPEAT_REACH_PX.touch
        : REPEAT_REACH_PX.pointer,
  };
}

/** The control calls this when it leaves the page: a press must not outlive the trigger it was made on. */
export function forgetOpeningPress(): void {
  opening = null;
  openedAt = null;
}

/**
 * Whether this press says the opening press again. If it does, the half second
 * starts over from it, but only within the first second after the opening.
 */
export function repeatsOpeningPress(event: PressPoint): boolean {
  if (!opening) return false;
  if (msSinceOpened() >= OPENING_CLICK_MS) return false;
  const now = performance.now();
  if (now - opening.at >= REPEAT_WINDOW_MS) return false;
  const near =
    Math.hypot(event.clientX - opening.x, event.clientY - opening.y) <=
    opening.reach;
  if (near) opening.at = now;
  return near;
}
