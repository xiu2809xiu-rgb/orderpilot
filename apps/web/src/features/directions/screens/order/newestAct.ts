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
 * An entry dated after `now` has not happened: the workflow's sample stamps
 * the steps of today at 16:00, so at noon they lie ahead, and a line that said
 * "Latest" for a moment still to come would be wrong. It is left out.
 */
export function latestAct(
  timeline: readonly OrderTimelineEvent[],
  now: Date,
): OrderTimelineEvent | null {
  let newest: OrderTimelineEvent | null = null;
  for (const entry of timeline) {
    if (entry.actor.kind !== "user") continue;
    if (Date.parse(entry.at) > now.getTime()) continue;
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
 * here; anything else keeps the workflow's own words, whole. The workflow's
 * real records start with the person's name ("Mei Tan: SEND_PI on SO-0001, ..."):
 * then the sentence already says who, and the line does not say it twice.
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
  const named = entry.summary.startsWith(name);
  return t(named ? "order.latest.otherNamed" : "order.latest.other", {
    summary: entry.summary,
    name,
    when,
  });
}
