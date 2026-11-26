import type { ReactNode } from "react";
import { ChipCheck } from "@/components/common/ChipCheck";
import { Button } from "@/components/ui/button";

/**
 * A yes or no filter as a button that stays pressed. A tick shows it is on, so
 * colour never says it alone. It looks and moves as the lists' chip does: the
 * two share components/common/chip.css.
 */
export function ToggleChip({
  pressed,
  onPressedChange,
  children,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={pressed}
      className="od-control od-toggle"
      onClick={() => {
        onPressedChange(!pressed);
      }}
    >
      <ChipCheck on={pressed} />
      {children}
    </Button>
  );
}
