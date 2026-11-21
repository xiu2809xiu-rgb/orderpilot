import { useEffect, useRef, useState, type FocusEvent } from "react";

/**
 * How the reason behind a mask is asked for, the same on every page. Hover and
 * focus belong to the tooltip, which closes on a press; the person's own tap or
 * click is kept apart so it is not lost with it, and pins the reason. A second
 * tap, Escape, a press elsewhere or a Tab away puts it away. The two masks
 * (the order pages' and the master-data pages') share this so that a mask
 * never behaves differently from the one beside it.
 */
export function useMaskReveal() {
  const button = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!pinned) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPinned(false);
    };
    const onPress = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      // A press on the mask itself is the second tap, which its click handles.
      if (button.current?.contains(target)) return;
      if (target.closest("[data-slot=tooltip-content]")) return;
      setPinned(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPress);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPress);
    };
  }, [pinned]);

  return {
    /** For the Tooltip root. */
    tooltip: { open: hovered || pinned, onOpenChange: setHovered },
    /** For the button that is the tooltip's trigger. */
    trigger: {
      ref: button,
      onClick: () => {
        setPinned((was) => !was);
      },
      onBlur: (event: FocusEvent<HTMLButtonElement>) => {
        // A reason pinned with Enter must not outlive the mark it explains
        // once the keyboard has moved on. Only a move to another element
        // counts: a tap inside the reason, or focus going nowhere, keeps it,
        // and a press elsewhere is already handled above.
        const to = event.relatedTarget;
        if (!(to instanceof Element)) return;
        if (event.currentTarget.contains(to)) return;
        if (to.closest("[data-slot=tooltip-content]")) return;
        setPinned(false);
      },
    },
  };
}
