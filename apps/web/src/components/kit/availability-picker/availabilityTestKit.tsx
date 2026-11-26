import type { PersonAvailability } from "@orderpilot/shared";
import { render } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, vi } from "vitest";
import { loadShellOverlays } from "@/app/shell/overlays/preload";
import { AvailabilityControl, pickerModule } from "./AvailabilityControl";
import type {
  AvailabilityPickerLabels,
  AvailabilityPickerProps,
} from "./types";

/** Passed in, so a test also proves that the part builds no word of its own. */
export const labels: AvailabilityPickerLabels = {
  trigger: "Your availability: Available. Change",
  menu: "Your availability",
  description: "It goes back to Available after 12 hours.",
  options: {
    AVAILABLE: "Available",
    FOCUSING: "Focusing",
    DO_NOT_DISTURB: "Do not disturb",
  },
  saving: "Saving your availability",
};

/** The picker's chunk and the shell's menus have arrived, as they have once the browser has prefetched them. */
export function loadPicker() {
  beforeAll(async () => {
    await loadShellOverlays();
    await pickerModule.load();
  });
}

interface HarnessProps extends Partial<AvailabilityPickerProps> {
  start?: PersonAvailability;
  onPick?: (next: PersonAvailability) => void;
}

/** The parent a real screen is: it owns the value and the trigger's name. */
function Harness({ start = "AVAILABLE", onPick, ...rest }: HarnessProps) {
  const [value, setValue] = useState(start);
  return (
    <AvailabilityControl
      labels={{
        ...labels,
        trigger: `Your availability: ${labels.options[value]}. Change`,
      }}
      {...rest}
      value={value}
      onChange={(next) => {
        onPick?.(next);
        setValue(next);
      }}
    />
  );
}

export function renderPicker(props: HarnessProps = {}) {
  return render(<Harness {...props} />);
}

/**
 * Radix keeps a closing pill in the page until its fold ends, and jsdom has no
 * animations: this gives a closed pill one, as the sheet does, so that a test
 * can see the same pill through a close and an opening within the fold. The
 * caller restores the mocks.
 */
export function holdFoldingPills(): void {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation(
    (node, pseudo) =>
      new Proxy(real(node, pseudo), {
        get(style, name) {
          if (name === "animationName") {
            return node.getAttribute("data-state") === "closed"
              ? "ap-fold"
              : "ap-grow";
          }
          const value: unknown = Reflect.get(style, name);
          if (typeof value !== "function") return value;
          return (...args: unknown[]): unknown =>
            Reflect.apply(value, style, args);
        },
      }),
  );
}
