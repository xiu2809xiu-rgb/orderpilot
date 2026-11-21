import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MaskReason } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * A column the role cannot see in any row says so once, here, instead of on
 * every cell: the title, then a lock that gives the server's reason. It is a
 * button, so a pointer, a finger and the keyboard all reach it.
 */
export function MaskedColumnHeader({
  label,
  reason,
}: {
  label: string;
  reason: MaskReason;
}) {
  const { t } = useTranslation("master-data");
  const { t: tc } = useTranslation("components");
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            // 24 px in a table head; the Button is 44 px on a touch screen.
            className="-my-0.5 size-6"
            aria-label={t("table.whyHidden", { column: label })}
          >
            <Lock className="size-3.5" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="space-y-1 text-sm">
          <p className="font-medium">{tc("masked.title")}</p>
          <p className="text-muted-foreground">
            {tc(`masked.reasons.${reason}`)}
          </p>
        </PopoverContent>
      </Popover>
    </span>
  );
}
