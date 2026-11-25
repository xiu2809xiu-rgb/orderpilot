// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import type { PersonAvailability } from "@orderpilot/shared";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import {
  useRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { availabilityLook } from "./tones";

/**
 * A press on a choice within this long of the pill's appearing is not a pick.
 * The pill opens over its trigger, so a second click of a double click lands
 * on the first choice; a person has not yet seen the choices by then.
 */
export const OPEN_GUARD_MS = 250;

/** One choice: a round orb with its mark, and its words. On a fine pointer the words are for assistive technology and the caption shows them; on a touch screen they sit under the orb. */
export function PickerOrb({
  value,
  index,
  label,
  onPick,
}: {
  value: PersonAvailability;
  index: number;
  label: string;
  onPick: (next: PersonAvailability) => void;
}) {
  const Mark = availabilityLook[value].mark;
  // Radix opens the menu on pointerdown, and the pill grows out of the
  // trigger, so the pointer is soon over a choice that it never pressed.
  // Radix's item answers a pointerup it has no pointerdown for by clicking
  // itself (react-menu 2.2.1), which would pick the first choice on a plain
  // click of the trigger. A choice is picked by a press and a release on it,
  // or by the keyboard, never by a release alone.
  const pressed = useRef(false);
  const shownAt = useRef(performance.now());
  // A finger is the same, one step later: it opens the menu on the press, the
  // browser sends a click to whatever lies under the finger after the release,
  // and by then the pill has grown there. A click that a pointer made (detail
  // 1 or more) is a pick only if this choice was pressed; the keyboard's
  // click, and one made by assistive technology, have detail 0 and pass. The
  // mark outlives the release (a touch screen's pointerleave comes before its
  // click), and goes with a pick or a cancelled gesture.
  const armed = useRef(false);
  const release = (event: PointerEvent<HTMLElement>) => {
    // preventDefault makes Radix's composed handler skip its own click().
    if (!pressed.current) event.preventDefault();
    pressed.current = false;
  };
  return (
    <MenuPrimitive.RadioItem
      value={value}
      data-value={value}
      className="ap-item"
      style={{ "--ap-i": index } as CSSProperties}
      onPointerDown={() => {
        if (performance.now() - shownAt.current < OPEN_GUARD_MS) return;
        pressed.current = true;
        armed.current = true;
      }}
      onClick={(event: MouseEvent<HTMLElement>) => {
        if (event.detail > 0 && !armed.current) event.preventDefault();
      }}
      onPointerUp={release}
      onPointerLeave={() => {
        pressed.current = false;
      }}
      onPointerCancel={() => {
        pressed.current = false;
        armed.current = false;
      }}
      // A repeat of the current value is a pick too: it renews the 12 hours.
      onSelect={() => {
        pressed.current = false;
        armed.current = false;
        onPick(value);
      }}
    >
      <span className="ap-orb" aria-hidden="true">
        <Mark nonScalingStroke strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="ap-label">{label}</span>
    </MenuPrimitive.RadioItem>
  );
}
