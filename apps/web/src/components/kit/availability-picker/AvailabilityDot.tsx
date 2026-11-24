// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import type { PersonAvailability } from "@orderpilot/shared";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { availabilityLook } from "./tones";
import "./availabilityDot.css";

/**
 * The coloured dot with its mark, and nothing else: no words and no
 * behaviour. A button, a list row or an avatar draws it and names it itself,
 * so it is hidden from assistive technology here.
 */
export function AvailabilityDot({
  value,
  className,
  style,
}: {
  value: PersonAvailability;
  className?: string;
  /** For a size that follows its parent. The sheet is outside Tailwind's layers, so a utility class would lose to it. */
  style?: CSSProperties;
}) {
  const Mark = availabilityLook[value].mark;
  return (
    <span
      className={cn("ap-dot", className)}
      style={style}
      data-value={value}
      aria-hidden="true"
    >
      <Mark
        className="ap-mark"
        nonScalingStroke
        strokeWidth={1.75}
        aria-hidden="true"
      />
    </span>
  );
}
