import { useTranslation } from "react-i18next";
import {
  PICTURE_LIST_STATUSES,
  type PictureListStatus,
} from "@orderpilot/shared";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

interface ReviewTabsProps {
  value: PictureListStatus;
  onChange: (next: PictureListStatus) => void;
  /** How many pictures wait for this reviewer. Nothing is drawn for zero. */
  waiting: number;
}

/**
 * Waiting for review, or approved: two choices in one radio group, so the
 * arrow keys move between them and Tab leaves. The waiting count is part of
 * the first choice's name.
 */
export function ReviewTabs({ value, onChange, waiting }: ReviewTabsProps) {
  const { t } = useTranslation("settings");
  return (
    <RadioGroup
      value={value}
      aria-label={t("pictures.tabs.label")}
      className="flex flex-wrap gap-s2"
      onValueChange={(next) => {
        const chosen = PICTURE_LIST_STATUSES.find((status) => status === next);
        if (chosen) onChange(chosen);
      }}
    >
      {PICTURE_LIST_STATUSES.map((status) => (
        <RadioGroupItem
          key={status}
          value={status}
          className={cn(
            "fs-14 inline-flex min-h-9 items-center gap-s2 rounded-md border border-border px-3 font-medium text-muted-foreground pointer-coarse:min-h-11",
            "hover:bg-accent hover:text-accent-foreground",
            "data-[state=checked]:border-ring data-[state=checked]:bg-accent data-[state=checked]:text-foreground",
          )}
        >
          {t(`pictures.tabs.${status}`)}
          {status === "PENDING" && waiting > 0 ? (
            <span data-numeric className="tabular-nums">
              {waiting.toLocaleString("en")}
            </span>
          ) : null}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
