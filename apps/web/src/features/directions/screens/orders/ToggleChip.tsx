import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** A yes or no filter as a button that stays pressed. A tick shows it is on, so colour never says it alone. */
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
      data-pressed={pressed}
      className="od-control od-toggle"
      onClick={() => {
        onPressedChange(!pressed);
      }}
    >
      {pressed ? <Check aria-hidden="true" /> : null}
      {children}
    </Button>
  );
}
