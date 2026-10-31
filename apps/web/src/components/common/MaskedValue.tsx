import { EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
 * A value hidden by role, with a reason on request. The server decides what is
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
  if (!masked) return <span data-numeric>{value}</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        role="img"
        aria-label={t("masked.hidden")}
        className="font-mono tracking-widest text-muted-foreground"
      >
        {"•".repeat(6)}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={t("masked.why")}
          >
            <EyeOff className="size-3.5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="space-y-1 text-sm">
          <p className="font-medium">{t("masked.title")}</p>
          <p className="text-muted-foreground">
            {t(`masked.reasons.${reason}`)}
          </p>
          {visibleTo ? (
            <p className="text-muted-foreground">
              {t("masked.visibleTo", { who: visibleTo })}
            </p>
          ) : null}
        </PopoverContent>
      </Popover>
    </span>
  );
}
