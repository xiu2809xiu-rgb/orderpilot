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
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  OPENING_CLICK_MS,
  OPEN_GUARD_MS,
  msSinceOpened,
  repeatsOpeningPress,
} from "./openingPress";
import { availabilityLook } from "./tones";

/** What this choice last saw of a press: none, one that may pick, or one that a rule refused. */
type Press = "none" | "taken" | "refused";

/**
 * One choice: a round orb with its mark, and its words. On a fine pointer the
 * words are for assistive technology and the caption shows them; on a touch
 * screen they sit under the orb. When a press picks is stated once, in
 * openingPress.ts; this part applies it to Radix's item (react-menu 2.2.1):
 * Radix clicks the item itself on a release that had no press (only on an item
 * never pressed since it mounted), and on Enter or Space with no look at
 * `repeat`, and it composes our handlers so that `preventDefault` skips its own.
 */
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
  // The mark outlives the release, and a touch screen's pointerleave comes
  // before its click, so no leave clears it. It goes with a pick or a cancel.
  const press = useRef<Press>("none");
  return (
    <MenuPrimitive.RadioItem
      value={value}
      data-value={value}
      className="ap-item"
      style={{ "--ap-i": index } as CSSProperties}
      onPointerDown={(event: PointerEvent<HTMLElement>) => {
        // Both are asked, so that every repeat restarts the half second.
        const repeat = repeatsOpeningPress(event);
        const early = msSinceOpened() < OPEN_GUARD_MS;
        press.current = repeat || early ? "refused" : "taken";
      }}
      // A release is never a pick: stopping it makes Radix skip its own click.
      onPointerUp={(event: PointerEvent<HTMLElement>) => {
        event.preventDefault();
      }}
      onClick={(event: MouseEvent<HTMLElement>) => {
        if (event.detail === 0) return;
        const unpressed =
          press.current === "none" && msSinceOpened() < OPENING_CLICK_MS;
        if (press.current === "refused" || unpressed) {
          press.current = "none";
          event.preventDefault();
        }
      }}
      onPointerCancel={() => {
        press.current = "none";
      }}
      // The key's own repeat is not a second pick: it would pick, close the
      // menu and give the focus back to the trigger, which the next repeat opens.
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        if (event.repeat && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
        }
      }}
      // A repeat of the current value is a pick too: it renews the 12 hours.
      onSelect={() => {
        press.current = "none";
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
