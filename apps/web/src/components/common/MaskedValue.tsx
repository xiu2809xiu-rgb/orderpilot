import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMaskReveal } from "../parts/useMaskReveal";

export type MaskReason = "role" | "bankDetails" | "price" | "policy";

interface MaskedValueProps {
  /** The real value. Only drawn when `masked` is false, and never put in the page otherwise. */
  value?: string;
  masked?: boolean;
  reason?: MaskReason;
  /** Who may see it, in words, for example "Finance". */
  visibleTo?: string;
}

/**
 * A value hidden by role, with a reason on request: the same mask as the order
 * page draws (components/parts), as dots and a lock, and the same behaviour
 * (`useMaskReveal`). The reason shows when the lock is hovered or focused; a
 * click or a tap keeps it, and a second one, Escape or a Tab away puts it
 * away. A screen reader hears it with the lock. The server decides what is
 * masked; this only shows it. When masked, `value` is ignored so a hidden
 * number cannot be read from the page.
 */
export function MaskedValue({
  value,
  masked = true,
  reason = "role",
  visibleTo,
}: MaskedValueProps) {
  const { t } = useTranslation("components");
  const reveal = useMaskReveal();
  if (!masked)
    return (
      <span data-numeric className="numeral">
        {value}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <span
        role="img"
        aria-label={t("masked.hidden")}
        className="numeral tracking-widest text-muted-foreground"
      >
        {"•".repeat(6)}
      </span>
      <Tooltip {...reveal.tooltip}>
        <TooltipTrigger asChild>
          <Button
            {...reveal.trigger}
            variant="ghost"
            size="icon"
            // The negative margin keeps the 24 px target without making a
            // table row taller than its text; the Button is 44 px on a touch screen.
            className="-my-0.5 size-6"
            aria-label={t("masked.why")}
          >
            <Lock className="size-3.5" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 space-y-1 text-left">
          <p className="font-medium">{t("masked.title")}</p>
          <p>{t(`masked.reasons.${reason}`)}</p>
          {visibleTo ? (
            <p>{t("masked.visibleTo", { who: visibleTo })}</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
