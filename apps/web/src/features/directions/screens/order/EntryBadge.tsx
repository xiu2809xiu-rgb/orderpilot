import type { SalesOrderDetail } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/kit/Badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EntryChip } from "../orders/EntryChip";

/**
 * Where the order came from, as a small badge by the title: Sample for an
 * order of the synthetic demo set, or the entry state (Draft, Submitted, Void)
 * of one entered here. What it means for this person, that a sample is read
 * only here, opens from the badge with a click, a tap or the keyboard, which
 * a hover tooltip would not give a tablet.
 */
export function EntryBadge({ detail }: { detail: SalesOrderDetail }) {
  const { t } = useTranslation("directions-orders");
  const state = detail.captureState;
  const meaning = t(`order.entry.${state ?? "sample"}`);
  const label = state ? t(`entry.${state}`) : t("source.sample");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-fact="entry"
          aria-label={`${label}. ${meaning}`}
          className="od-entry-badge pointer-coarse:min-h-11"
        >
          {state ? (
            <EntryChip state={state} />
          ) : (
            <Badge variant="outline" radius="full">
              {label}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="fs-14 w-72">
        {meaning}
      </PopoverContent>
    </Popover>
  );
}
