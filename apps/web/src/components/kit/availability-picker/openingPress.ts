/**
 * The press that opened the pill, kept for a moment so that the pill's choices
 * can tell a repeat of it from a choice. The pill grows over its trigger, so
 * the second click of a double click lands on the first choice: the quarter
 * second in PickerOrb stops a fast one, and this stops a slower one, up to the
 * system's double-click time (500 ms on Windows). A person who chooses has
 * moved the pointer or has waited; a person who repeats the click has done
 * neither. It expires by its own time, so a pill opened later by the keyboard,
 * or from a button that is not the trigger, is never held back by an old press.
 */
export const REPEAT_WINDOW_MS = 500;
/** How far a repeat may land from the opening press: a finger never lands on the same pixel twice. */
export const REPEAT_REACH_PX = { pointer: 8, touch: 24 } as const;

interface Press {
  readonly x: number;
  readonly y: number;
  readonly at: number;
  readonly reach: number;
}
interface PressPoint {
  clientX: number;
  clientY: number;
  pointerType?: string;
}

let opening: Press | null = null;

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

export function repeatsOpeningPress(event: PressPoint): boolean {
  if (!opening || performance.now() - opening.at >= REPEAT_WINDOW_MS) {
    return false;
  }
  return (
    Math.hypot(event.clientX - opening.x, event.clientY - opening.y) <=
    opening.reach
  );
}
