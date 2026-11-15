import { Clock, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { calendarDaysBetween } from "@/lib/format";
import { cn } from "@/lib/utils";
import { timerParts } from "../../features/directions/data/timer";
import { StatusChip } from "../kit/StatusChip";
import { useNow } from "./useNow";

interface DueTimerProps {
  due: Date | string;
  /** Pins the clock, for a picture or a test. Otherwise the time moves on by itself. */
  now?: Date;
  className?: string;
}

/**
 * How far a task is from its due time, in words: "Due in 3 h", "2 days late", counted in calendar days.
 * Late is a red chip with a warning icon, due within four hours an amber chip
 * with a clock, later a quiet line with a clock. The icon and the words carry
 * the meaning, so colour never does alone.
 */
export function DueTimer({ due, now, className }: DueTimerProps) {
  const { t } = useTranslation("directions-parts");
  const current = useNow(now);
  const dueAt = typeof due === "string" ? new Date(due) : due;
  const sums = timerParts(dueAt, current);
  // Days late are calendar days in Singapore, as the order and tracker pages
  // count them; elapsed whole days would read one less here. Hours stay.
  const parts =
    sums.late && sums.unit === "days"
      ? { ...sums, amount: calendarDaysBetween(dueAt, current) }
      : sums;
  const key =
    parts.unit === "now"
      ? parts.late
        ? "lateNow"
        : "now"
      : `${parts.late ? "late" : "due"}${parts.unit[0]?.toUpperCase() ?? ""}${parts.unit.slice(1)}`;
  const text = t(`timer.${key}`, { count: parts.amount });
  return (
    <time dateTime={dueAt.toISOString()} className={className}>
      {parts.tone === "later" ? (
        <span
          className={cn(
            "fs-14 numeral inline-flex items-center gap-1.5 text-muted-foreground",
          )}
        >
          <Clock className="size-3.5" aria-hidden="true" />
          {text}
        </span>
      ) : (
        <StatusChip
          kind={parts.tone === "late" ? "destructive" : "warning"}
          icon={parts.tone === "late" ? TriangleAlert : Clock}
        >
          {text}
        </StatusChip>
      )}
    </time>
  );
}
