import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** How long a name stays after a touch: a tap goes to the page at once, and a name that is gone by then is never read. */
const TOUCH_HOLD_MS = 1600;

/**
 * The tooltip beside a row of the rail. Loaded by `RailTip`. It opens on
 * hover and on keyboard focus, as a tooltip does, and on a touch or a pen
 * press, which Radix leaves out: the name is held for a moment so that it can
 * be read before the tap's own click would close it.
 */
export default function RailTipBody({
  tip,
  children,
}: {
  tip: ReactNode;
  children: ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const hold = useRef<number | undefined>(undefined);
  const release = () => {
    window.clearTimeout(hold.current);
    hold.current = undefined;
  };
  useEffect(() => release, []);
  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        // The click that ends a tap would close the name that the press opened.
        if (!next && hold.current !== undefined) return;
        setOpen(next);
      }}
    >
      <TooltipTrigger
        asChild
        onPointerDown={(event) => {
          if (event.pointerType === "mouse") return;
          release();
          setOpen(true);
          hold.current = window.setTimeout(() => {
            hold.current = undefined;
            setOpen(false);
          }, TOUCH_HOLD_MS);
        }}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="fs-14"
        // Escape must still put a name away while a touch holds it.
        onEscapeKeyDown={release}
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
