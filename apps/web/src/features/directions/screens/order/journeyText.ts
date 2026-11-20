import type { TFunction } from "i18next";
import type { Usual } from "../../data/estimates";
import { formatDay } from "@/lib/format";
import type { Journey } from "./journeyModel";

const SHORT_DAY = new Intl.DateTimeFormat("en-SG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Singapore",
});

/** "Tue 17 Nov": a day with its weekday, from `YYYY-MM-DD` or a date. */
export function formatWeekday(value: string | Date): string {
  const date =
    typeof value === "string"
      ? new Date(`${value.slice(0, 10)}T12:00:00Z`)
      : value;
  return SHORT_DAY.format(date);
}

const SHORT = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Singapore",
});

/** "3 days", "6 h" or "the same day": a step's usual time in words. */
export function usualWords(t: TFunction, usual: Usual): string {
  switch (usual.kind) {
    case "sameDay":
      return t("journey.usual.sameDay");
    case "hours":
      return t("journey.usual.hours", { count: usual.amount });
    case "days":
      return t("journey.usual.days", { count: usual.amount });
  }
}

/**
 * The line under each step of the rail: who finished it and when, how long the
 * current one has waited against what it usually takes, or when a later one is
 * expected. A step the data says nothing about has no line and shows only its
 * state word.
 */
export function journeyDetails(
  t: TFunction,
  journey: Journey,
  /** The full rail has 120 px a step: dates lose the year, and the current step has no line, because the order page says who holds the order and how late it is once, above. */
  compact = false,
): Partial<Record<number, string>> {
  const details: Partial<Record<number, string>> = {};
  const day = (value: Date) =>
    compact ? SHORT.format(value) : formatDay(value);
  for (const step of journey.steps) {
    if (step.state === "done" && step.doneBy) {
      details[step.position] = t("journey.doneBy", {
        actor: step.doneBy.actor,
        when: day(step.doneBy.at),
      });
    } else if (step.state === "now" && step.since !== null && !compact) {
      const waited = step.waitedDays ?? 0;
      const since =
        waited === 0
          ? t("journey.sinceToday")
          : t("journey.since", { when: day(step.since), count: waited });
      details[step.position] = step.usual
        ? t(step.late ? "journey.sinceLate" : "journey.sinceUsual", {
            since,
            usual: usualWords(t, step.usual),
          })
        : since;
    } else if (step.state === "later") {
      if (step.expectedOn) {
        details[step.position] = t("journey.by", {
          when: formatWeekday(step.expectedOn),
        });
      } else if (step.usual) {
        details[step.position] = t("journey.usually", {
          usual: usualWords(t, step.usual),
        });
      } else if (compact && journey.ship?.missing.includes(step.id)) {
        // The forecast of the ship day leaves this step out: say so on the step itself.
        details[step.position] = t("journey.noUsual");
      }
    }
  }
  return details;
}
