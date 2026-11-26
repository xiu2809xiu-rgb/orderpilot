// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import type { PersonAvailability } from "@orderpilot/shared";
import { useState, type ComponentPropsWithRef } from "react";
import { cn } from "@/lib/utils";
import { AvailabilityDot } from "./AvailabilityDot";
import "./availabilityDot.css";

export interface AvailabilityTriggerProps extends Omit<
  ComponentPropsWithRef<"button">,
  "children"
> {
  value: PersonAvailability;
  /** The button's name, with the value in words: "Your availability: Do not disturb. Change". */
  label: string;
  /** "dot" for a small avatar, "ring" for a large one. */
  skin?: "dot" | "ring";
  /** A save is in flight. The button is not disabled, so focus can come back to it. */
  busy?: boolean;
  /** Raised by the parent after a pick: plays the pulse and the sheen once. */
  pulse?: number;
  /** The pill is in the page and covers the face. Set by the part that draws the pill, never by the menu's state alone. */
  pillOpen?: boolean;
}

/**
 * The button of both skins. It draws the dot (and the ring), and it is also
 * the stand-in the shell shows before the menu's chunk has arrived, so it
 * carries no behaviour of its own: Radix, or the stand-in, adds the menu's
 * attributes and handlers.
 */
export function AvailabilityTrigger({
  value,
  label,
  skin = "dot",
  busy = false,
  pulse = 0,
  pillOpen = false,
  className,
  ...rest
}: AvailabilityTriggerProps) {
  // A pulse that was already there when the button appeared is not a new pick.
  const [seen] = useState(pulse);
  return (
    <button
      type="button"
      {...rest}
      className={cn("ap-trigger", className)}
      data-skin={skin}
      data-value={value}
      aria-label={label}
      aria-busy={busy || undefined}
      data-pill-open={pillOpen ? "" : undefined}
    >
      <span className="ap-face" aria-hidden="true">
        {skin === "ring" ? <span className="ap-ring" /> : null}
        <AvailabilityDot value={value} />
        {pulse !== seen ? (
          <span key={pulse} className="ap-pulse">
            <span className="ap-sheen" />
          </span>
        ) : null}
      </span>
    </button>
  );
}
