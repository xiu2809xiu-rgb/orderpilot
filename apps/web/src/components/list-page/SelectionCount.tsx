import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface SelectionCountProps {
  count: number;
  onClear: () => void;
}

/**
 * How many rows are ticked, with Clear. The count is a live region that is
 * always there, so a screen reader hears each change.
 */
export function SelectionCount({ count, onClear }: SelectionCountProps) {
  const { t } = useTranslation("list-page");
  return (
    <span className="inline-flex items-center gap-1">
      <span
        role="status"
        className="text-sm text-muted-foreground tabular-nums"
      >
        {count > 0 ? t("selection.count", { count }) : ""}
      </span>
      {count > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="pointer-coarse:h-11"
          onClick={onClear}
        >
          <X aria-hidden="true" />
          {t("selection.clear")}
        </Button>
      ) : null}
    </span>
  );
}
