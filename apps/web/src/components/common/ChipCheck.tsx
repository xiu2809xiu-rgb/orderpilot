import { Check } from "lucide-react";
import "./chip.css";

/**
 * The check of a chosen chip, in a slot that is always there. The slot eases
 * open when the chip is chosen, so the label slides over instead of jumping.
 * The check stays the non-colour sign of "on".
 */
export function ChipCheck({ on }: { on: boolean }) {
  return (
    <span className="chip-slot" data-on={on} aria-hidden="true">
      <Check />
    </span>
  );
}
