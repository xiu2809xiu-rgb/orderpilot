import type { PersonAvailability } from "@orderpilot/shared";

/** The picker's words. The kit calls no translation: the parent passes every word. */
export interface AvailabilityPickerLabels {
  /** The trigger's name, with the current value in it: "Your availability: Do not disturb. Change". */
  trigger: string;
  /** The menu's name: "Your availability". */
  menu: string;
  /** Read once when the menu opens, never drawn in the pill. */
  description: string;
  /** The three names, in words. */
  options: Record<PersonAvailability, string>;
  /** Read while a change is being saved. */
  saving: string;
}

export interface AvailabilityPickerProps {
  /** The parent's value, after the 12-hour fall-back. */
  value: PersonAvailability;
  /** Called for a person's pick, a repeat of the current value included, never for a prop change. */
  onChange: (next: PersonAvailability) => void;
  labels: AvailabilityPickerLabels;
  /** "dot" for small avatars, "ring" for the large one. */
  skin?: "dot" | "ring";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** A save is in flight: a press does nothing. */
  busy?: boolean;
  /** The parent raises it after a pick, to play the pulse and the sheen. */
  pulse?: number;
  /** The parent's positioning of the trigger. */
  className?: string;
}
