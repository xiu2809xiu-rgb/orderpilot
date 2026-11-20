import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// The API's LOW_STOCK_THRESHOLD, which no response carries. Both are samples
// for the demo until Spectra sets the real level.
const LOW_UNDER = 25;

/**
 * Says how an item comes to be marked Short or Low, in the words of the rule
 * the API applies. A button, so that a pointer, a finger and the keyboard all
 * reach it; it sits where the mark is shown.
 */
export function StockRule() {
  const { t } = useTranslation("master-data");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          // 24 px in a table head or beside a badge; the Button is 44 px on touch.
          className="-my-0.5 size-6 text-muted-foreground"
          aria-label={t("stockRule.label")}
        >
          <Info className="size-3.5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="space-y-1.5 text-sm">
        <p className="font-medium">{t("stockRule.title")}</p>
        <p className="text-muted-foreground">{t("stockRule.short")}</p>
        <p className="text-muted-foreground">
          {t("stockRule.low", { count: LOW_UNDER })}
        </p>
      </PopoverContent>
    </Popover>
  );
}
