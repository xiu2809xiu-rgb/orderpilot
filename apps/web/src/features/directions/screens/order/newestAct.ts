import type { OrderTimelineEvent } from "@orderpilot/shared";
import type { TFunction } from "i18next";

const DAY = new Intl.DateTimeFormat("en-SG", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Singapore",
});
const TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Singapore",
});

/**
 * The newest entry of the order's timeline that a person made. The system's own
 * entries (a task created, a reminder sent) are not an act, so they never
 * count. When two entries share a moment the later one in the list wins, so a
 * payment and its step, written together, do not swap places between reads.
 */
export function latestAct(
  timeline: readonly OrderTimelineEvent[],
): OrderTimelineEvent | null {
  let newest: OrderTimelineEvent | null = null;
  for (const entry of timeline) {
    if (entry.actor.kind !== "user") continue;
    if (!newest || Date.parse(entry.at) >= Date.parse(newest.at)) {
      newest = entry;
    }
  }
  return newest;
}

const STEP_PREFIX = "Step done: ";

/**
 * "Latest: Hafiz Rahman marked Packed as done, 6 Nov at 16:00". A step the
 * workflow records as "Step done: X" reads as a sentence; a payment is said
 * without its amount, which a role that may not see figures should not read
 * here; anything else keeps the workflow's own words.
 */
export function latestWords(t: TFunction, entry: OrderTimelineEvent): string {
  const at = new Date(entry.at);
  const when = t("order.latest.when", {
    day: DAY.format(at),
    time: TIME.format(at),
  });
  const name = entry.actor.name;
  if (entry.kind === "payment.confirmed") {
    return t("order.latest.payment", { name, when });
  }
  if (
    entry.kind === "step.completed" &&
    entry.summary.startsWith(STEP_PREFIX)
  ) {
    return t("order.latest.stepDone", {
      name,
      step: entry.summary.slice(STEP_PREFIX.length),
      when,
    });
  }
  return t("order.latest.other", { summary: entry.summary, name, when });
}
