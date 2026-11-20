import {
  Suspense,
  lazy,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
  const [open, setOpen] = useState(false);
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
  // Native listeners on the wrapper: pointer and focus both reach it from
  // the button inside, and it is not a control itself.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const show = () => {
      setOpen(true);
    };
    const hide = () => {
      setOpen(false);
    };
    el.addEventListener("pointerenter", show);
    el.addEventListener("pointerleave", hide);
    el.addEventListener("focusin", show);
    el.addEventListener("focusout", hide);
    return () => {
      el.removeEventListener("pointerenter", show);
      el.removeEventListener("pointerleave", hide);
      el.removeEventListener("focusin", show);
      el.removeEventListener("focusout", hide);
    };
  }, []);
  return (
    <span ref={box} className={cn("relative inline-flex", className)}>
      {children}
      <span id={descriptionId} hidden>
        {hint}
      </span>
      <Suspense fallback={null}>
        <HintTipBody hint={hint} open={open} onOpenChange={setOpen} />
      </Suspense>
    </span>
  );
}
