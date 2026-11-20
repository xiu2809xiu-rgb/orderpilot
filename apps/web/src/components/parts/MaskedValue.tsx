import { Lock } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface MaskedValueProps {
  /** Whether the server hid it. */
  masked: boolean;
  /** The value; never drawn, and never put in the page, while `masked`. */
  value?: string | null;
  /** The server's reason, shown on focus or hover and read out by a screen reader. */
  reason?: string | null;
  className?: string;
}

/**
 * A figure the person's role may not see, shown as a mask. The reason appears
 * when the mask is focused or hovered, and a screen reader hears it as the
 * mask's description, so "hidden" is never unexplained. A tap or a click also
 * shows it and keeps it, because a touch screen has no hover and no focus
 * ring: a second one or Escape puts it away. An unmasked value is plain text,
 * tabular. The server decides; this only shows it.
 */
export function MaskedValue({
  masked,
  value,
  reason,
  className,
}: MaskedValueProps) {
  const { t } = useTranslation("directions-parts");
  const reasonId = useId();
  const button = useRef<HTMLButtonElement>(null);
  // Hover and focus belong to the tooltip, which closes on a press; the
  // person's own tap or click is kept apart so it is not lost with it.
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
  if (!masked) {
    return <span className={cn("numeral", className)}>{value}</span>;
  }
  const line = t("masked.reasonLine", {
    reason: reason ?? t("masked.defaultReason"),
  });
  return (
    <Tooltip open={hovered || pinned} onOpenChange={setHovered}>
      <TooltipTrigger asChild>
        <button
          ref={button}
          type="button"
          onClick={() => {
            setPinned((was) => !was);
          }}
          aria-describedby={reasonId}
          className={cn(
            "numeral inline-flex min-h-6 cursor-help items-center gap-1 text-muted-foreground",
            "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "pointer-coarse:min-h-11",
            className,
          )}
        >
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          <span aria-hidden="true">{"•".repeat(6)}</span>
          <span className="sr-only">{t("masked.mask")}</span>
          <span id={reasonId} className="sr-only">
            {line}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{line}</TooltipContent>
    </Tooltip>
  );
}
