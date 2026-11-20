import {
  Suspense,
  lazy,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { useHoverTip } from "@/components/common/useHoverTip";
import { cn } from "@/lib/utils";

// Like the rail's tooltip, its code is a chunk of its own, so the entry
// bundle does not carry it.
const HintTipBody = lazy(() => import("./HintTipBody"));

/**
 * Says what a button of the top bar does before it is pressed: a tooltip on
 * hover and on focus, and the same words as the button's description for
 * assistive technology. It wraps a button or a link it does not own, so the
 * description is attached to the first one inside it. The button stays where
 * it is when the tooltip's code arrives: only the tooltip is added beside it.
 */
export function HintTip({
  hint,
  className,
  children,
}: {
  hint: string;
  className?: string;
  children: ReactNode;
}) {
  const descriptionId = useId();
  const box = useRef<HTMLSpanElement>(null);
  // The button is another component's, so it cannot be given the id as a prop.
  useEffect(() => {
    const target = box.current?.querySelector("button, a");
    const current = target?.getAttribute("aria-describedby") ?? "";
    if (!target || current.split(" ").includes(descriptionId)) return;
    target.setAttribute(
      "aria-describedby",
      `${current} ${descriptionId}`.trim(),
    );
  });
  // Pointer and focus both reach the wrapper from the button inside, and it
  // is not a control itself. The tip outlasts the pointer a moment, so the
  // pointer can cross onto it (WCAG 2.2, 1.4.13).
  const tip = useHoverTip(box, { holdsFocus: true });
  return (
    <span ref={box} className={cn("relative inline-flex", className)}>
      {children}
      <span id={descriptionId} hidden>
        {hint}
      </span>
      <Suspense fallback={null}>
        <HintTipBody
          hint={hint}
          open={tip.open}
          onOpenChange={(open) => {
            if (!open) tip.close();
          }}
          onPointerEnter={tip.enter}
          onPointerLeave={tip.leave}
        />
      </Suspense>
    </span>
  );
}
