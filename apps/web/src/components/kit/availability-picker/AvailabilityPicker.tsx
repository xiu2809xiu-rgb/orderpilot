// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { useState, type CSSProperties, type KeyboardEvent } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { PickerPill } from "./PickerPill";
import { GROW_EASING, GROW_MS } from "./pickerMotion";
import type { AvailabilityPickerProps } from "./types";
import "./availabilityPicker.css";

export type PickerContentProps = Pick<
  AvailabilityPickerProps,
  | "value"
  | "onChange"
  | "labels"
  | "skin"
  | "side"
  | "align"
  | "onCloseAutoFocus"
> & { descriptionId: string };

/** A finger, or a screen with no hover: the words go under the orbs and the boxes are 44 px. */
export const COARSE = "(pointer: coarse), (hover: none)";

const growth = {
  "--ap-spring": GROW_EASING,
  "--ap-grow": `${String(GROW_MS)}ms`,
} as CSSProperties;

/** On open the checked item has focus, by mouse and by keyboard. Radix would focus the content. */
function focusChecked(event: Event) {
  event.preventDefault();
  const pill = event.currentTarget;
  if (!(pill instanceof HTMLElement)) return;
  pill
    .querySelector<HTMLElement>('[role="menuitemradio"][aria-checked="true"]')
    ?.focus();
}

/**
 * Radix's menu passes `onOpenAutoFocus` to its focus scope (react-menu 2.2.1)
 * but leaves it out of the content's types, so it goes in by spread. The
 * picker's tests open the menu by mouse and by keyboard and fail if it stops
 * working after an upgrade.
 */
const openFocus = { onOpenAutoFocus: focusChecked };

/**
 * Left and Right move like Down and Up, which Radix does (with `loop`). The
 * pill is drawn across, so the keys must follow the picture. One helper walks
 * the items, so the two pairs cannot differ at the ends.
 */
function sideways(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="menuitemradio"]',
    ),
  ];
  if (items.length === 0) return;
  event.preventDefault();
  const at = items.findIndex((item) => item === document.activeElement);
  const step = event.key === "ArrowRight" ? 1 : -1;
  items[(at + step + items.length) % items.length]?.focus();
}

/**
 * The menu's content: a glass pill that grows out of its trigger. It uses
 * Radix's primitives directly and not the wrapper in components/ui, because
 * the wrapper's own entrance classes could not be cleared by tailwind-merge
 * and would fight the pill's own animation. The pill is in a portal, so the
 * side panel and a small screen can never cut it.
 */
export function AvailabilityPicker({
  value,
  onChange,
  labels,
  skin = "dot",
  side = "top",
  align = "start",
  descriptionId,
  onCloseAutoFocus,
}: PickerContentProps) {
  const coarse = useMediaQuery(COARSE);
  const [settled, setSettled] = useState(false);
  // The pill's near corner lies over its trigger, so it can grow out of it.
  const sideOffset = coarse ? -44 : skin === "ring" ? -32 : -24;
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        className="ap-pill"
        data-skin={skin}
        data-settled={settled ? "" : undefined}
        style={growth}
        side={side}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        loop
        aria-label={labels.menu}
        // Radix names the menu by its trigger, which holds the old value.
        aria-labelledby={undefined}
        aria-describedby={descriptionId}
        aria-orientation="horizontal"
        {...openFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        onKeyDown={sideways}
        onAnimationEnd={(event) => {
          // The glass blur is switched on once the growth is over: a blurred
          // box that scales is repainted each frame.
          if (
            event.target === event.currentTarget &&
            event.animationName === "ap-grow"
          ) {
            setSettled(true);
          }
        }}
      >
        <PickerPill value={value} onChange={onChange} labels={labels} />
      </MenuPrimitive.Content>
    </MenuPrimitive.Portal>
  );
}
