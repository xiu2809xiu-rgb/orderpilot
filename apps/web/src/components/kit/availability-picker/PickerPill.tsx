// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import {
  personAvailabilitySchema,
  type PersonAvailability,
} from "@orderpilot/shared";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { useLayoutEffect, useRef, useState, type FocusEvent } from "react";
import { PickerOrb } from "./PickerOrb";
import { chipPlace } from "./pickerMotion";
import { AVAILABILITY_ORDER } from "./tones";
import type { AvailabilityPickerLabels } from "./types";
import { useChipSpring } from "./useChipSpring";

type Widths = Partial<Record<PersonAvailability, number>>;

/** The caption follows the item that has focus (Radix focuses an item on pointer move and on arrow), else the checked one. */
function useActive(checked: PersonAvailability) {
  const [focused, setFocused] = useState<PersonAvailability | null>(null);
  const follow = (event: FocusEvent<HTMLElement>) => {
    const item = event.target.closest<HTMLElement>('[role="menuitemradio"]');
    const parsed = personAvailabilitySchema.safeParse(item?.dataset.value);
    if (parsed.success) setFocused(parsed.data);
  };
  return { active: focused ?? checked, follow };
}

/**
 * The words' widths, so the caption can fit its word. Measured when the pill
 * appears and again when the fonts are ready, because the first measure may be
 * of a fallback face.
 */
function useWordWidths(labels: AvailabilityPickerLabels) {
  const measure = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<Widths>({});
  useLayoutEffect(() => {
    let live = true;
    const read = () => {
      const root = measure.current;
      if (!root || !live) return;
      const next: Widths = {};
      for (const word of root.querySelectorAll<HTMLElement>("[data-name]")) {
        const parsed = personAvailabilitySchema.safeParse(word.dataset.name);
        if (parsed.success) {
          // The layout width: the pill is drawn scaled while it grows, and a
          // drawn width would be a fraction of the word.
          next[parsed.data] = word.offsetWidth;
        }
      }
      setWidths(next);
    };
    read();
    if ("fonts" in document) {
      void document.fonts.ready.then(read);
    }
    return () => {
      live = false;
    };
  }, [labels]);
  return { measure, widths };
}

/** The inside of the pill: three orbs and, on a fine pointer, the caption that glides under the active one. */
export function PickerPill({
  value,
  onChange,
  labels,
}: {
  value: PersonAvailability;
  onChange: (next: PersonAvailability) => void;
  labels: AvailabilityPickerLabels;
}) {
  const { active, follow } = useActive(value);
  const { measure, widths } = useWordWidths(labels);
  const index = AVAILABILITY_ORDER.indexOf(active);
  const place = chipPlace(index, widths[active] ?? 0);
  const chip = useChipSpring(place, index);
  return (
    <>
      <MenuPrimitive.RadioGroup
        value={value}
        className="ap-orbs"
        onFocusCapture={follow}
      >
        {AVAILABILITY_ORDER.map((option, at) => (
          <PickerOrb
            key={option}
            value={option}
            index={at}
            label={labels.options[option]}
            onPick={onChange}
          />
        ))}
      </MenuPrimitive.RadioGroup>
      {/* The words are in the items, so the caption is for the eye only. */}
      <span ref={chip} className="ap-chip" aria-hidden="true">
        <span key={active} className="ap-chip-text">
          {labels.options[active]}
        </span>
      </span>
      <span ref={measure} className="ap-measure" aria-hidden="true">
        {AVAILABILITY_ORDER.map((option) => (
          <span key={option} data-name={option}>
            {labels.options[option]}
          </span>
        ))}
      </span>
    </>
  );
}
