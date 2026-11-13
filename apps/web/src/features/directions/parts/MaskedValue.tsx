import { Lock } from "lucide-react";
import { useId } from "react";
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
 * mask's description, so "hidden" is never unexplained. An unmasked value is
 * plain text in the direction's figure face. The server decides; this only
 * shows it.
 */
export function MaskedValue({
  masked,
  value,
  reason,
  className,
}: MaskedValueProps) {
  const { t } = useTranslation("directions-parts");
  const reasonId = useId();
  if (!masked) {
    return <span className={cn("numeral", className)}>{value}</span>;
  }
  const line = t("masked.reasonLine", {
    reason: reason ?? t("masked.defaultReason"),
  });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
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
