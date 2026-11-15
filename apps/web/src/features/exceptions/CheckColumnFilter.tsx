import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CHECK_FILTER_OPTIONS } from "./checkLabels";

/** Stands for "no check picked" in the radio group, which takes no empty value. */
const ANY = "__any__";

/**
 * The Check column's own header: the label, a chevron, and a menu of the
 * check types seen in the queue today, with "All checks" at the top. Narrows
 * the rows already on screen, the same way the order tracker's Status column
 * narrows its own list.
 */
export function CheckColumnFilter({
  value,
  onSelect,
}: {
  value: string | undefined;
  onSelect: (value: string | undefined) => void;
}) {
  const { t } = useTranslation("exceptions");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("list.columns.ruleFilterLabel")}
          data-narrowed={value ? "true" : undefined}
          className="relative -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:after:absolute pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-['']"
        >
          {t("list.columns.rule")}
          <ChevronDown
            className={cn(
              "size-3.5",
              value ? "text-primary" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
          {value ? (
            <span
              className="size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={value ?? ANY}
          onValueChange={(next) => {
            onSelect(next === ANY ? undefined : next);
          }}
        >
          <DropdownMenuRadioItem value={ANY}>
            {t("list.checkFilter.all")}
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          {CHECK_FILTER_OPTIONS.map((label) => (
            <DropdownMenuRadioItem key={label} value={label}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
