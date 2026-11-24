// Kit: "Avatar Status Picker" idea by Nitish Khagwal (https://x.com/nitishkmrk/status/2121129936497111406/video/1),
// seen on LeiBox (https://leibox.pantoria.cn, github.com/leishifu666/LeiBox) on 24 Nov 2026. LeiBox states that no
// separate licence was supplied or verified for the original and marks it as not redistributable. This is OrderPilot's
// own build from a written description of the behaviour (proportions, spring feel, a caption that follows the choice,
// a flash of light after a pick, the keyboard model): no source, markup, picture, font, colour or glyph drawing was
// copied. A private prototype for a school module. Adapted to OrderPilot's tokens.
import type { PersonAvailability } from "@orderpilot/shared";
import { Check, Circle, Minus, type LucideIcon } from "lucide-react";

interface AvailabilityLook {
  /** The design token that colours the dot, by name. */
  tone: "success" | "warning" | "destructive";
  /** One silhouette for each value, so colour is never the only signal: a tick, a ring and a bar. */
  mark: LucideIcon;
}

/**
 * How each value looks. No words live here: they come from the parent, in
 * the person's language. The tones are the order-status colours, so no new
 * token exists; the marks and the words carry the meaning.
 */
export const availabilityLook: Record<PersonAvailability, AvailabilityLook> = {
  AVAILABLE: { tone: "success", mark: Check },
  FOCUSING: { tone: "warning", mark: Circle },
  DO_NOT_DISTURB: { tone: "destructive", mark: Minus },
};

/** The order of the three choices in the pill, left to right. */
export const AVAILABILITY_ORDER: readonly PersonAvailability[] = [
  "AVAILABLE",
  "FOCUSING",
  "DO_NOT_DISTURB",
];
